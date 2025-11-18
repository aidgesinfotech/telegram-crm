const Siteconfigs = require('../models/siteconfigModel');

exports.createSiteconfig = async (req, res) => {
    try {
        const result = await Siteconfigs.create(req.body);
        res.status(201).json({ message: 'Siteconfig created', id: result.insertId });
    } catch (err) {
        console.error('Error creating Siteconfig:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getAllSiteconfigs = async (req, res) => {
    try {
        const results = await Siteconfigs.getAll();
        res.status(200).json(results);
    } catch (err) {
        console.error('Error fetching Siteconfigs:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updateSiteconfig = async (req, res) => {
    const id = req.params.id;
    try {
        await Siteconfigs.update(id, req.body,req.userDetails);
        res.status(200).json({ message: 'Siteconfig updated' });
    } catch (err) {
        console.error('Error updating Siteconfig:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deleteSiteconfig = async (req, res) => {
    const id = req.params.id;
    try {
        await Siteconfigs.delete(id);
        res.status(200).json({ message: 'Siteconfig deleted' });
    } catch (err) {
        console.error('Error deleting Siteconfig:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};