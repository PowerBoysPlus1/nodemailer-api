// server.js
const express = require("express");
const nodemailer = require("nodemailer");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
require("dotenv").config();

const app = express();

// Security middlewares
app.use(helmet()); // Sets security headers
app.use(express.json({ limit: "10kb" })); // Limit body size
app.disable("x-powered-by"); // Hide Express signature

// Rate limiting - prevent spam
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: "Too many email requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/send-email", limiter);

// CORS configuration (adjust origins as needed)
app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    process.env.ALLOWED_ORIGIN || "*"
  );
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP configuration error:", error);
  } else {
    console.log("SMTP server is ready to send emails");
  }
});

// Email sending endpoint with validation
app.post(
  "/api/send-email",
  [body("html").optional().isLength({ max: 10000 })],
  async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { html } = req.body;

    // Email options
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: process.env.SMTP_TO,
      subject: "Pedido de Contacto",
      html: html,
    };

    try {
      const info = await transporter.sendMail(mailOptions);

      res.status(200).json({
        success: true,
        message: "Email sent successfully",
        messageId: info.messageId,
      });
    } catch (error) {
      console.error("Error sending email:", error);

      res.status(500).json({
        success: false,
        message: "Failed to send email",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Endpoint not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const PORT = process.env.PORT || 3000;

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Email service running on port ${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;

