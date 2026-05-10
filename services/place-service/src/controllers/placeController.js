const { v4: uuidv4 } = require('uuid');
const db = require('../db');

exports.getPlaces = async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT p.*, c.label as category_label 
            FROM places p 
            JOIN place_categories c ON p.category_id = c.id
            WHERE p.deleted_at IS NULL AND p.status = 'approved'
        `);
        res.status(200).json({ message: "Success", data: { places: rows }, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.getPlaceById = async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT p.*, c.label as category_label 
            FROM places p 
            JOIN place_categories c ON p.category_id = c.id
            WHERE p.id = ? AND p.deleted_at IS NULL
        `, [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Place not found", data: null, error: { code: "NOT_FOUND" } });
        }

        res.status(200).json({ message: "Success", data: { place: rows[0] }, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.createPlace = async (req, res) => {
    const { category_id, name, description, address, city, latitude, longitude } = req.body;
    
    try {
        const placeId = uuidv4();
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000);
        
        await db.execute(`
            INSERT INTO places (id, category_id, submitted_by, name, slug, description, address, city, latitude, longitude, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `, [placeId, category_id, req.user.id, name, slug, description, address, city, latitude, longitude]);

        res.status(201).json({ message: "Place created successfully", data: { place_id: placeId }, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.getBookmarks = async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT p.* FROM places p
            JOIN bookmarks b ON p.id = b.place_id
            WHERE b.user_id = ?
        `, [req.user.id]);
        
        res.status(200).json({ message: "Success", data: { bookmarks: rows }, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.addBookmark = async (req, res) => {
    const place_id = req.params.placeId;
    try {
        await db.execute(`INSERT IGNORE INTO bookmarks (user_id, place_id) VALUES (?, ?)`, [req.user.id, place_id]);
        res.status(201).json({ message: "Bookmark added", data: null, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.removeBookmark = async (req, res) => {
    try {
        await db.execute(`DELETE FROM bookmarks WHERE user_id = ? AND place_id = ?`, [req.user.id, req.params.placeId]);
        res.status(200).json({ message: "Bookmark removed", data: null, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.getTags = async (req, res) => {
    try {
        const [rows] = await db.execute(`SELECT * FROM tags`);
        res.status(200).json({ message: "Success", data: { tags: rows }, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.getCategories = async (req, res) => {
    try {
        const [rows] = await db.execute(`SELECT * FROM place_categories`);
        res.status(200).json({ message: "Success", data: { categories: rows }, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.getRecommendations = async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT p.*, c.label as category_label 
            FROM places p 
            JOIN place_categories c ON p.category_id = c.id
            WHERE p.deleted_at IS NULL AND p.status = 'approved'
            ORDER BY p.quiet_score DESC
            LIMIT 10
        `);
        res.status(200).json({ message: "Success", data: { recommendations: rows }, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};
