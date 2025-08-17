const { ObjectId } = require('mongodb');
const express = require('express');
const router = express.Router();

module.exports = function (articlesCollection) {
    router.get('/', async (req, res) => {
        try {
            const query = {
                isPremium: true,
                status: 'approved',
            };

            const premiumArticles = await articlesCollection.find(query).toArray();
            res.send(premiumArticles);
        } catch (error) {
            console.error('Error fetching premium articles:', error);
            res.status(500).send({ message: 'Internal Server Error' });
        }
    });
    router.get('/:id', async (req, res) => {
        try {
            const id = req.params.id;

            // Check if ID is a valid ObjectId
            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: 'Invalid article ID.' });
            }

            const article = await articlesCollection.findOne({
                _id: new ObjectId(id),
                isPremium: true,
                status: 'approved',
            });

            if (!article) {
                return res.status(404).send({ message: 'Article not found or not approved.' });
            }

            res.send(article);
        } catch (error) {
            console.error('Error fetching premium article by ID:', error);
            res.status(500).send({ message: 'Internal Server Error' });
        }
    });


    return router;
};
