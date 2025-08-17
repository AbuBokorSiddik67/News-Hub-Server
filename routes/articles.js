const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

module.exports = (articlesCollection, usersCollection, verifyToken, verifyAdmin) => {

    // 2. Get trending articles (Public Route)
    router.get('/trending', async (req, res) => {
        try {
            const trending = await articlesCollection.find({ status: 'approved' })
                .sort({ viewCount: -1 }) // Sort by viewCount in descending order
                .limit(6) // Get top 6 trending articles
                .toArray();
            res.send(trending);
        } catch (error) {
            console.error("Error fetching trending articles:", error);
            res.status(500).send({ message: 'Error fetching trending articles', error: error.message });
        }
    });

    // 3. Get articles by a specific author (Protected Route: For User/Author Dashboards)
    router.get('/my-articles/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        // Ensure the email in the token matches the requested email for security
        if (!req.decoded || email !== req.decoded.email) {
            return res.status(403).send({ message: 'Forbidden Access: Email mismatch or invalid token' });
        }
        const query = { authorEmail: email }; // Assuming articles have authorEmail field
        try {
            const result = await articlesCollection.find(query).toArray();
            res.send(result);
        } catch (error) {
            console.error("Error fetching user's articles:", error);
            res.status(500).send({ message: "Failed to fetch user's articles", error: error.message });
        }
    });

    // 4. Get all articles for Admin Management (Protected Route: Admin only)
    router.get('/all-articles-admin', verifyToken, verifyAdmin, async (req, res) => {
        const { search, publisher } = req.query;
        let query = {};

        if (search) {
            query.title = { $regex: search, $options: 'i' }; // Case-insensitive search by title
        }
        if (publisher && publisher !== '') { // Ensure publisher filter is applied only if not empty string
            query.publisher = publisher; // Filter by publisher name
        }

        try {
            const result = await articlesCollection.find(query).toArray();
            res.send(result);
        } catch (error) {
            console.error("Error fetching all articles for admin:", error);
            res.status(500).send({ message: "Internal Server Error" });
        }
    });

    // 5. Update article status (Admin only)
    router.patch('/status/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: 'Invalid Article ID' });
        }
        const { status } = req.body; // Expects { status: 'approved' | 'declined' | 'pending' }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
            $set: {
                status: status,
            },
        };
        try {
            const result = await articlesCollection.updateOne(filter, updateDoc);
            if (result.matchedCount === 0) {
                return res.status(404).send({ message: "Article not found." });
            }
            res.send(result);
        } catch (error) {
            console.error("Error updating article status:", error);
            res.status(500).send({ message: "Failed to update article status", error: error.message });
        }
    });

    // 6. Add a new article (Protected Route: Requires Authentication)
    router.post('/', verifyToken, async (req, res) => {
        const article = req.body;
        try {
            // Ensure necessary fields are initialized if not provided by frontend
            article.viewCount = article.viewCount || 0;
            article.postedDate = article.postedDate ? new Date(article.postedDate) : new Date();
            // Default status for new articles
            article.status = article.status || 'pending';
            const result = await articlesCollection.insertOne(article);
            res.status(201).send(result);
        } catch (error) {
            console.error("Error adding new article:", error);
            res.status(500).send({ message: "Failed to add new article", error: error.message });
        }
    });

    // 7. Get all articles (General/Public Route with filtering, pagination, search)
    router.get('/', async (req, res) => {
        const { search, publisher, tags, status, page = 1, limit = 10, sortField = 'postedDate', sortOrder = -1 } = req.query;
        let query = { status: 'approved' }; // Only fetch 'approved' articles for public view by default

        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }
        if (publisher && publisher !== 'All' && publisher !== '') {
            query.publisher = publisher;
        }
        if (tags) {
            query.tags = { $in: tags.split(',').map(tag => tag.trim()) };
        }
        // Admin or specific roles might need to fetch other statuses, but for public '/articles' this is usually 'approved'.
        if (status) {
            // If public route needs to show other statuses, uncomment and refine this:
            // query.status = status;
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sort = {};
        const allowedSortFields = ['postedDate', 'viewCount', 'title'];
        if (allowedSortFields.includes(sortField)) {
            sort[sortField] = parseInt(sortOrder);
        } else {
            sort.postedDate = -1; // Default sort if invalid field is provided
        }

        try {
            const articles = await articlesCollection.find(query)
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .toArray();
            const totalArticles = await articlesCollection.countDocuments(query);
            res.send({ articles, totalArticles });
        } catch (error) {
            console.error("Error fetching articles:", error);
            res.status(500).send({ message: "Failed to fetch articles", error: error.message });
        }
    });
    // Premium article
    router.get('/', async (req, res) => {
        try {
            const { isPremium } = req.query;

            const query = {
                status: "approved", // শুধু approved article
            };

            if (isPremium === 'true') {
                query.isPremium = true;
            }

            const articles = await articlesCollection.find(query).toArray();
            res.send(articles);
        } catch (error) {
            console.error('Failed to fetch articles:', error);
            res.status(500).send({ message: 'Internal Server Error' });
        }
    });


    // 8. Get a single article by ID (Public Route)
    router.get('/:id', async (req, res) => {
        const id = req.params.id;

        // Validate if the ID is a valid MongoDB ObjectId format before proceeding
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: 'Invalid Article ID format' });
        }

        try {
            const query = { _id: new ObjectId(id) };
            const article = await articlesCollection.findOne(query);

            if (!article) {
                return res.status(404).send({ message: 'Article not found' });
            }

            // Increment viewCount for the article
            await articlesCollection.updateOne(query, { $inc: { viewCount: 1 } });

            res.send(article);
        } catch (error) {
            console.error("Error fetching article by ID:", error);
            res.status(500).send({ message: 'Error fetching article', error: error.message });
        }
    });


    // 9. Update an article (Protected Route: Admin/Author)
    router.patch('/:id', verifyToken, async (req, res) => {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: 'Invalid Article ID format' });
        }

        const updatedArticle = req.body;
        const filter = { _id: new ObjectId(id) };

        if (updatedArticle.status && !req.isAdmin) {
            delete updatedArticle.status;
        }

        const updateDoc = {
            $set: { ...updatedArticle }
        };
        try {
            const result = await articlesCollection.updateOne(filter, updateDoc);
            if (result.matchedCount === 0) {
                return res.status(404).send({ message: "Article not found." });
            }
            res.send(result);
        } catch (error) {
            console.error("Error updating article:", error);
            res.status(500).send({ message: "Failed to update article", error: error.message });
        }
    });

    router.get("/", async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;

        const query = { status: "approved" };

        const articles = await Article.find(query).skip(skip).limit(limit).exec();
        const totalArticles = await Article.countDocuments(query);

        res.json({ articles, totalArticles });
    });


    // 10. Delete an article (Protected Route: Admin/Author)
    router.delete('/:id', verifyToken, async (req, res) => {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: 'Invalid Article ID format' });
        }

        const query = { _id: new ObjectId(id) };
        try {
            const result = await articlesCollection.deleteOne(query);
            if (result.deletedCount === 0) {
                return res.status(404).send({ message: "Article not found." });
            }
            res.send(result);
        } catch (error) {
            console.error("Error deleting article:", error);
            res.status(500).send({ message: "Failed to delete article", error: error.message });
        }
    });

    return router;
};