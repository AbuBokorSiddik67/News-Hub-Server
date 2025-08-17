// server/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

const connectDB = require('./config/dbConnect');
const admin = require('./config/firebaseAdmin');

const jwtRouter = require('./routes/jwt');

const verifyToken = require('./middlewares/verifyToken');
const verifyAdmin = require('./middlewares/verifyAdmin');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.use(cors({
    origin: [
        'https://news-letter-fb213.web.app',
    ],
    credentials: true,
}));
app.use(express.json());

async function startServer() {
    try {
        const { client, database } = await connectDB();

        const articlesCollection = database.collection("articles");
        const usersCollection = database.collection("users");
        const publishersCollection = database.collection("publishers");
        const paymentsCollection = database.collection("payments");

        const adminMiddleware = verifyAdmin(usersCollection);

        app.use('/jwt', jwtRouter);

        const usersRouter = require('./routes/users')(usersCollection, verifyToken, adminMiddleware);
        app.use('/users', usersRouter);

        const articlesRouter = require('./routes/articles')(articlesCollection, usersCollection, verifyToken, adminMiddleware);
        app.use('/articles', articlesRouter);

        const publishersRouter = require('./routes/publishers')(publishersCollection, verifyToken, adminMiddleware);
        app.use('/publishers', publishersRouter);

        const paymentsRouter = require('./routes/payments')(paymentsCollection, usersCollection, verifyToken, stripe, adminMiddleware);
        app.use('/payments', paymentsRouter);

        const adminRouter = require('./routes/admin')(articlesCollection, usersCollection, paymentsCollection, verifyToken, adminMiddleware);
        app.use('/admin-stats', adminRouter);

        app.get('/', (req, res) => {
            res.send('NewsHub Server is running!');
        });

        // Stripe Payment Intent
        app.post("/create-payment-intent", verifyToken, async (req, res) => {
            const { amountInCents, email } = req.body;
            if (!amountInCents || amountInCents <= 0) {
                return res.status(400).send({ error: "Invalid amount provided." });
            }
            if (req.decoded.email !== email) {
                return res.status(403).send({ error: "Unauthorized: Email mismatch." });
            }

            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amountInCents,
                    currency: "usd",
                    payment_method_types: ["card"],
                });
                res.send({
                    clientSecret: paymentIntent.client_secret,
                });
            } catch (error) {
                console.error("Error creating payment intent:", error);
                res.status(500).send({ error: error.message });
            }
        });

        // Save payment information
        app.post('/payments', verifyToken, async (req, res) => {
            const payment = req.body;
            const userEmail = req.decoded.email;

            if (userEmail !== payment.email) {
                return res.status(403).send({ success: false, message: 'Forbidden access: Email mismatch.' });
            }

            try {
                const paymentResult = await paymentsCollection.insertOne(payment);

                if (payment.paymentPurpose === 'subscription') {
                    const premiumEndDate = new Date();
                    premiumEndDate.setDate(premiumEndDate.getDate() + 30); // 30 days premium

                    const updateResult = await usersCollection.updateOne(
                        { email: payment.email },
                        {
                            $set: {
                                isPremium: true,
                                premiumTaken: new Date(payment.paymentDate),
                                premiumEndDate: premiumEndDate
                            }
                        }
                    );

                    if (updateResult.modifiedCount > 0) {
                        res.send({ success: true, paymentResult, userUpdateResult: updateResult, message: 'Payment successful and user premium status updated.' });
                    } else {
                        res.send({ success: true, paymentResult, message: 'Payment successful, but user premium status might not have changed (already premium or user not found).' });
                    }
                } else {
                    res.send({ success: true, paymentResult, message: 'Payment successful.' });
                }
            } catch (error) {
                console.error("Error saving payment or updating user:", error);
                res.status(500).send({ success: false, message: 'Failed to save payment or update user status.', error: error.message });
            }
        });

        app.patch('/users/update-premium-status', verifyToken, async (req, res) => {
            const { email, premiumTaken, premiumEndDate } = req.body;

            if (req.decoded.email !== email) {
                return res.status(403).send({ success: false, message: 'Forbidden access: Email mismatch.' });
            }

            try {
                const query = { email: email };
                const updateDoc = {
                    $set: {
                        isPremium: true,
                        premiumTaken: new Date(premiumTaken),
                        premiumEndDate: new Date(premiumEndDate)
                    }
                };
                const result = await usersCollection.updateOne(query, updateDoc);

                if (result.matchedCount === 0) {
                    return res.status(404).send({ success: false, message: 'User not found.' });
                }
                res.send({ success: true, message: 'Premium status updated successfully!' });
            } catch (error) {
                console.error("Error updating user premium status:", error);
                res.status(500).send({ success: false, message: 'Failed to update premium status.', error: error.message });
            }
        });

        app.patch('/users/check-and-reset-premium', verifyToken, async (req, res) => {
            const userEmail = req.decoded.email;
            const now = new Date();

            try {
                const user = await usersCollection.findOne({ email: userEmail });
                if (!user) return res.status(404).send({ success: false, message: 'User not found.' });

                if (user.isPremium && user.premiumEndDate && now > new Date(user.premiumEndDate)) {
                    await usersCollection.updateOne(
                        { email: userEmail },
                        { $set: { isPremium: false, premiumTaken: null, premiumEndDate: null } }
                    );
                    res.send({ success: true, message: 'Premium expired and reset.', isPremium: false });
                } else {
                    res.send({ success: true, message: 'Premium status is valid or not applicable.', isPremium: user.isPremium || false });
                }
            } catch (error) {
                console.error("Error checking/resetting premium status:", error);
                res.status(500).send({ success: false, message: 'Server error during premium check.' });
            }
        });

        const premiumArticlesRouter = require('./routes/premiumArticles')(articlesCollection);
        app.use('/premium-articles', premiumArticlesRouter);

        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");

        app.listen(port, () => {
            console.log(`NewsHub Server is running on port ${port}`);
        });

    } catch (error) {
        console.error("Failed to start server or connect to database:", error);
        process.exit(1);
    }
}

startServer();