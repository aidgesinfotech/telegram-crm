const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com",
  port: 465,
  secure: true,
  auth: {
    user: "info@aidges.com",
    pass: "Vraj@1011"
  }
});

module.exports = transporter;