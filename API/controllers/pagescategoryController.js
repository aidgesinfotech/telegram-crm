const Pagecategorys = require('../models/pagescategoryModel');

exports.createPagecategory = async (req, res) => {
  try {
    const result = await Pagecategorys.create(req.body,req.userDetails);
    res.status(201).json({ message: 'Pagecategory created', id: result.insertId });
  } catch (err) {
    console.error('Error creating Pagecategory:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllPagecategorys = async (req, res) => {
  try {
    const results = await Pagecategorys.getAll();
    res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching Pagecategorys:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllPageCategorysByPage = async (req, res) => {
  try {
    const { limit = 10, page = 1, searchtxt = '' } = req.query;
    
    const results = await Pagecategorys.getAllByPage(Number(limit), Number(page), searchtxt);

    res.status(200).json({
      status: 'success',
      data: results.data,
      totalCount: results.totalCount,
      totalPages: Math.ceil(results.totalCount / limit),
      currentPage: page
    });
  } catch (err) {
    console.error('Error fetching Pagecategorys:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updatePagecategory = async (req, res) => {
  const id = req.params.id;
  try {
    await Pagecategorys.update(id, req.body,req.userDetails);
    res.status(200).json({ message: 'Pagecategory updated' });
  } catch (err) {
    console.error('Error updating Pagecategory:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deletePagecategory = async (req, res) => {
  const id = req.params.id;
  try {
    await Pagecategorys.delete(id,req.userDetails);
    res.status(200).json({ message: 'Pagecategory deleted' });
  } catch (err) {
    console.error('Error deleting Pagecategory:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
