const express = require('express');
const { ObjectId } = require('mongodb'); // Don't forget ObjectId
const router = express.Router();

// This module exports a function that takes necessary dependencies as arguments
// (usersCollection, verifyToken, verifyAdmin)
module.exports = (usersCollection, verifyToken, verifyAdmin) => {

    // 1. Add a new user or update existing user on login/registration
    // This route is typically called when a user first logs in using social auth (e.g., Firebase)
    router.post('/', async (req, res) => {
        const user = req.body;
        const query = { email: user.email };
        const existingUser = await usersCollection.findOne(query);

        // If user already exists in DB, no need to insert again.
        if (existingUser) {
            return res.send({ message: 'user already exists', insertedId: null });
        }
        // Insert new user into the collection
        const result = await usersCollection.insertOne(user);
        res.send(result);
    });

    // 2. Get all users (Admin only)
    // This route is for administrative purposes, e.g., in an admin dashboard
    router.get('/', verifyToken, verifyAdmin, async (req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
    });

    // 3. Check if a user is an admin
    // This is used by the frontend to conditionally render UI elements or routes for admins.
    router.get('/admin/:email', verifyToken, async (req, res) => {
        const email = req.params.email;

        if (email !== req.decoded.email) {
            return res.status(403).send({ message: 'Forbidden Access: Email mismatch' });
        }
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        let admin = false;
        if (user) {
            admin = user?.role === 'admin'; // Check the 'role' field for 'admin'
        }
        res.send({ admin }); // Send back a boolean indicating admin status
    });

    router.get('/premium/:email', verifyToken, async (req, res) => {
        const email = req.params.email;

        if (req.decoded.email !== email) {
            return res.status(403).send({ message: 'Forbidden Access: Email mismatch' });
        }
        try {
            const user = await usersCollection.findOne({ email: email });

            if (!user) {
                return res.status(404).send({ message: 'User not found' });
            }
            // Assuming your user document has an 'isPremium' field
            res.send({ isPremium: user?.isPremium || false }); // Return false if isPremium field is missing
        } catch (error) {
            console.error("Error checking premium status:", error);
            res.status(500).send({ message: 'Failed to check premium status', error: error.message });
        }
    });

    router.patch('/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        const updatedData = req.body; // { name: "New Name", photoURL: "new_url.jpg" }

        // Security check: Ensure the email in the request matches the email in the token
        if (email !== req.decoded.email) {
            return res.status(403).send({ message: 'Forbidden Access: Email mismatch' });
        }

        const filter = { email: email };
        const updateDoc = {
            $set: {
                displayName: updatedData.name, // Assuming you store name as displayName
                photoURL: updatedData.photoURL,
                // You might also update other fields here
            },
        };
        try {
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        } catch (error) {
            console.error("Error updating user profile in DB:", error);
            res.status(500).send({ message: "Internal Server Error" });
        }
    });

    // 4. Make a user admin (Admin only)
    // Used by admins to promote other users to admin role.
    router.patch('/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) }; // Find user by their MongoDB _id
        const updateDoc = {
            $set: {
                role: 'admin' // Set their role to 'admin'
            },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
    });

    // 5. Delete a user (Admin only)
    router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }; // Find user by their MongoDB _id
        const result = await usersCollection.deleteOne(query);
        res.send(result);
    });

    // 6. Update user's premium status and subscription details
    router.patch('/premium/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        // Security check: Ensure the email in the request matches the email in the token
        if (email !== req.decoded.email) {
            return res.status(403).send({ message: 'Forbidden Access: Email mismatch' });
        }

        // Extract update fields from request body
        const { premiumTaken, subscriptionEndDate, premiumArticlesLimit, subscriptionPlan, lastPaymentDate } = req.body;
        const filter = { email: email };
        const updateDoc = {
            $set: {
                premiumTaken: premiumTaken, // Boolean: true if premium, false otherwise
                subscriptionEndDate: subscriptionEndDate, // Date when premium access expires
                premiumArticlesLimit: premiumArticlesLimit, // Number of premium articles user can view, or -1 for unlimited
                subscriptionPlan: subscriptionPlan, // Name of the subscribed plan (e.g., 'Premium Monthly', 'Premium Yearly')
                lastPaymentDate: lastPaymentDate, // Date of the last successful payment
            }
        };
        try {
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        } catch (error) {
            console.error("Error updating user's premium status:", error);
            res.status(500).send({ message: "Failed to update premium status", error: error.message });
        }
    });

    return router;
};