const express = require('express');
const router = express.Router();

module.exports = (publishersCollection, verifyToken, verifyAdmin) => {

    // Get all publishers (Public route)
    router.get('/', async (req, res) => {
        try {
            const result = await publishersCollection.find().toArray();
            res.send(result);
        } catch (error) {
            console.error("Error fetching publishers:", error);
            res.status(500).send({ message: "Failed to fetch publishers", error: error.message });
        }
    });

    // Add a new publisher (Admin only)
    router.post('/', verifyToken, verifyAdmin, async (req, res) => {
        const newPublisher = req.body;
        // Optional: Check if publisher already exists by name
        const existingPublisher = await publishersCollection.findOne({
            publisher: newPublisher.
                publisher
        });
        if (existingPublisher) {
            return res.status(409).send({ message: 'Publisher with this name already exists.' });
        }
        try {
            const result = await publishersCollection.insertOne(newPublisher);
            res.status(201).send(result);
        } catch (error) {
            console.error("Error adding publisher:", error);
            res.status(500).send({ message: "Failed to add publisher", error: error.message });
        }
    });

    return router;
};