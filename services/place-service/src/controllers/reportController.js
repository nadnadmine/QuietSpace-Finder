const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { publishEvent } = require('../utils/rabbitmq');

exports.getReports = async (req, res) => {
    const placeId = req.params.placeId;
    try {
        const [rows] = await db.execute(`
            SELECT * FROM condition_reports WHERE place_id = ? ORDER BY reported_at DESC
        `, [placeId]);
        
        res.status(200).json({ message: "Success", data: { reports: rows }, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.createReport = async (req, res) => {
    const placeId = req.params.placeId;
    const { noise_level, crowd_level, comfort_level, facility_rating, ambiance_rating, comment } = req.body;
    
    try {
        // Calculate a simple average for quiet_score (this can be more complex)
        const quiet_score = (noise_level + crowd_level + comfort_level + facility_rating + ambiance_rating) / 5;
        const reportId = uuidv4();

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            
            await conn.execute(`
                INSERT INTO condition_reports 
                (id, place_id, reported_by, noise_level, crowd_level, comfort_level, facility_rating, ambiance_rating, quiet_score, comment)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [reportId, placeId, req.user.id, noise_level, crowd_level, comfort_level, facility_rating, ambiance_rating, quiet_score, comment]);
            
            // Recalculate place quiet_score
            await conn.execute(`
                UPDATE places 
                SET quiet_score = (SELECT AVG(quiet_score) FROM condition_reports WHERE place_id = ?),
                    report_count = report_count + 1
                WHERE id = ?
            `, [placeId, placeId]);

            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

        // Publish event to RabbitMQ
        await publishEvent('place_events', {
            event_id: uuidv4(),
            event_type: 'report.submitted',
            source_service: 'place-service',
            payload: { report_id: reportId, place_id: placeId, user_id: req.user.id }
        });

        res.status(201).json({ message: "Report submitted successfully", data: { report_id: reportId }, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.getReportById = async (req, res) => {
    try {
        const [rows] = await db.execute(`SELECT * FROM condition_reports WHERE id = ?`, [req.params.reportId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Report not found", data: null, error: { code: "NOT_FOUND" } });
        }
        res.status(200).json({ message: "Success", data: { report: rows[0] }, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.deleteReport = async (req, res) => {
    try {
        // Simplified check, normally admin could also delete.
        const [result] = await db.execute(`DELETE FROM condition_reports WHERE id = ?`, [req.params.reportId]);
        if (result.affectedRows === 0) {
             return res.status(404).json({ message: "Report not found", data: null, error: { code: "NOT_FOUND" } });
        }
        res.status(200).json({ message: "Report deleted successfully", data: null, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};

exports.voteReport = async (req, res) => {
    const { is_helpful } = req.body;
    if (typeof is_helpful !== 'boolean') {
        return res.status(400).json({ message: "Validation failed", data: null, error: { code: "VALIDATION_ERROR", details: "is_helpful must be a boolean" } });
    }
    
    try {
        await db.execute(`
            INSERT INTO report_helpfulness (report_id, user_id, is_helpful) 
            VALUES (?, ?, ?) 
            ON DUPLICATE KEY UPDATE is_helpful = ?
        `, [req.params.reportId, req.user.id, is_helpful ? 1 : 0, is_helpful ? 1 : 0]);
        
        res.status(200).json({ message: "Vote recorded successfully", data: null, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", data: null, error: { code: "INTERNAL_ERROR" } });
    }
};
