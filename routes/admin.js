const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

module.exports = (articlesCollection, usersCollection, paymentsCollection, verifyToken, verifyAdmin) => {
    // Get admin statistics (Protected Route: Admin only)
    router.get('/', verifyToken, verifyAdmin, async (req, res) => {
        try {
            // 1. Total Users
            const totalUsers = await usersCollection.countDocuments();

            // 2. Total Articles & Status Counts
            const totalArticles = await articlesCollection.countDocuments();
            const approvedArticles = await articlesCollection.countDocuments({ status: 'approved' });
            const pendingArticles = await articlesCollection.countDocuments({ status: 'pending' });
            const declinedArticles = await articlesCollection.countDocuments({ status: 'declined' });

            // 3. Total Views (sum of viewCount from all approved articles)
            const totalViewsResult = await articlesCollection.aggregate([
                { $match: { status: 'approved' } }, // Only sum views from approved articles
                { $group: { _id: null, total: { $sum: '$viewCount' } } }
            ]).toArray();
            const totalViews = totalViewsResult.length > 0 ? totalViewsResult[0].total : 0;

            // 4. Top 5 Most Viewed Articles
            const topArticles = await articlesCollection.find({ status: 'approved' })
                .sort({ viewCount: -1 })
                .limit(5)
                .project({ title: 1, viewCount: 1, _id: 0 }) // Only fetch title and viewCount
                .toArray();

            // 5. Article Distribution by Publisher
            const articleCountByPublisherResult = await articlesCollection.aggregate([
                { $match: { status: 'approved' } }, // Count approved articles per publisher
                { $group: { _id: '$publisher', count: { $sum: 1 } } }
            ]).toArray();

            const articleCountByPublisher = articleCountByPublisherResult.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {});

            res.send({
                totalUsers,
                totalArticles,
                approvedArticles,
                pendingArticles,
                declinedArticles,
                totalViews,
                topArticles,
                articleCountByPublisher,
            });

        } catch (error) {
            console.error("Error fetching admin statistics:", error);
            res.status(500).send({ message: "Internal Server Error", error: error.message });
        }
    });

    return router;
};