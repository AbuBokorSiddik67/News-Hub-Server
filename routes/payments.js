// server/routes/payments.js
const express = require('express');
const router = express.Router();

module.exports = (paymentsCollection, usersCollection, verifyToken, stripe, verifyAdmin) => {

    // 1. Endpoint to create a payment intent (client secret)
    router.post('/create-payment-intent', verifyToken, async (req, res) => {
        const { amountInCents, email } = req.body; // Changed from 'price' to 'amountInCents' to match frontend and index.js

        if (!amountInCents || amountInCents <= 0) {
            return res.status(400).send({ message: 'Invalid amount provided.' });
        }
        // Security check: Ensure the email from the request body matches the email from the decoded token
        if (req.decoded.email !== email) {
            return res.status(403).send({ error: "Unauthorized: Email mismatch." });
        }

        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amountInCents, // Use amountInCents directly
                currency: 'usd',
                payment_method_types: ['card'],
            });
            res.send({ clientSecret: paymentIntent.client_secret });
        } catch (error) {
            console.error('Error creating payment intent:', error);
            res.status(500).send({ message: 'Failed to create payment intent', error: error.message || 'Unknown error' });
        }
    });

    // 2. Endpoint to save payment details after successful payment
    router.post('/', verifyToken, async (req, res) => {
        const payment = req.body;
        const userEmail = req.decoded.email; // Get email from decoded token

        // Security check: Ensure the authenticated user's email matches the payment email
        if (userEmail !== payment.email) { // Changed from payment.userEmail to payment.email to match paymentData in PaymentForm.jsx
            return res.status(403).send({ success: false, message: 'Forbidden access: Email mismatch.' });
        }

        if (!payment.email || !payment.transactionId || !payment.amount || !payment.paymentPurpose) { // Changed planName to paymentPurpose
            return res.status(400).send({ success: false, message: 'Missing required payment details.' });
        }

        try {
            payment.paymentDate = new Date(payment.paymentDate); // Ensure date is a proper Date object
            const result = await paymentsCollection.insertOne(payment);

            if (payment.paymentPurpose === 'subscription') { // Check paymentPurpose for subscription
                const premiumEndDate = new Date();
                premiumEndDate.setDate(premiumEndDate.getDate() + 30); // Assuming 30 days for subscription

                const updateResult = await usersCollection.updateOne(
                    { email: payment.email },
                    {
                        $set: {
                            isPremium: true,
                            premiumTaken: payment.paymentDate,
                            premiumEndDate: premiumEndDate
                        }
                    }
                );

                if (updateResult.modifiedCount > 0) {
                    res.send({ success: true, paymentResult: result, userUpdateResult: updateResult, message: 'Payment successful and user premium status updated.' });
                } else {
                    res.send({ success: true, paymentResult: result, message: 'Payment successful, but user premium status might not have changed (already premium or user not found).' });
                }
            } else {
                res.send({ success: true, paymentResult: result, message: 'Payment successful.' });
            }
        } catch (error) {
            console.error("Error saving payment or updating user:", error);
            res.status(500).send({ success: false, message: "Failed to save payment details or update user status", error: error.message });
        }
    });

    // 3. Get all payments (Admin only)
    router.get('/', verifyToken, verifyAdmin, async (req, res) => {
        try {
            const result = await paymentsCollection.find().toArray();
            res.send(result);
        } catch (error) {
            console.error("Error fetching payments:", error);
            res.status(500).send({ message: "Failed to fetch payments", error: error.message });
        }
    });

    // 4. Get payments by user email (For user's payment history)
    router.get('/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        if (req.decoded && email !== req.decoded.email) {
            return res.status(403).send({ message: 'Forbidden Access: Email mismatch or invalid token' });
        }
        try {
            const payments = await paymentsCollection.find({ email: email }).sort({ paymentDate: -1 }).toArray(); // Changed userEmail to email
            res.send(payments);
        } catch (error) {
            console.error("Error fetching user's payments:", error);
            res.status(500).send({ message: "Failed to fetch user's payment history", error: error.message });
        }
    });

    return router;
};