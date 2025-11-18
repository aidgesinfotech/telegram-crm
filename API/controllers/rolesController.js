const Roles = require('../models/rolesModel');


exports.createRole = async (req, res) => {
  try {
    const result = await Roles.create(req.body,req.userDetails);
    res.status(201).json({ message: 'Role created', id: result.insertId });
  } catch (err) {
    console.error('Error creating Role:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllRoles = async (req, res) => {
  try {
    const results = await Roles.getAll();
    res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching Roles:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateRole = async (req, res) => {
  const id = req.params.id;
  try {
    await Roles.update(id, req.body,req.userDetails);
    res.status(200).json({ message: 'Role updated' });
  } catch (err) {
    console.error('Error updating Role:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteRole = async (req, res) => {
  const id = req.params.id;
  try {
    await Roles.delete(id,req.userDetails);
    res.status(200).json({ message: 'Role deleted' });
  } catch (err) {
    console.error('Error deleting Role:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
