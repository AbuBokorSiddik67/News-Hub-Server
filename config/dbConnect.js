const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.DATABASE_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function connectDB() {
    try {
        // await client.connect(); // Optional in newer driver versions, connects on first operation
        const database = client.db("NewsHubDB"); // Your database name
        console.log("MongoDB connected successfully!");
        return { client, database };
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        throw error; // Re-throw to handle in index.js
    }
}

module.exports = connectDB;