require("dotenv").config();
const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");
const db = require("./db");
const mailer = require("./mailer");
const app = express();

// Middleware
app.use(express.json());
app.use(cors()); // Allows frontend to talk to backend
app.use(express.static(__dirname)); // Serves your HTML/CSS/JS files

// 1. Razorpay Configuration
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// 2. Create Order Endpoint
app.post("/create-order", async (req, res) => {
  try {
    const options = {
      amount: req.body.amount * 100, // Amount in paise (e.g., 100 INR = 10000 paise)
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    };
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).send("Error creating order");
  }
});

// 3. Verify Payment & Send Notifications
app.post("/verify-payment", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email, name, phone, amount, message } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    // Payment Successful
    console.log("Payment Verified");

    // Save to MySQL Database
    const sql = `
      INSERT INTO donations 
      (name, email, phone, amount, message, payment_id, order_id, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
      name, email, phone, amount, message, 
      razorpay_payment_id, razorpay_order_id, "SUCCESS"
    ], (err, result) => {
      if (err) {
        console.error("Database Error:", err);
        return res.status(500).json({ status: "error", message: "Database error" });
      }

      // Send Emails
      const mailData = { name, email, phone, amount, payment_id: razorpay_payment_id };
      mailer.sendDonationThankYou(mailData).catch(console.error);
      mailer.sendDonationAdminMail(mailData).catch(console.error);

      res.json({ status: "success" });
    });
  } else {
    res.status(400).json({ status: "failed" });
  }
});

// 5. Admin: View Donations
app.get("/admin/donations", (req, res) => {
  db.query("SELECT * FROM donations ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err });
    res.json(rows);
  });
});

// 6. Volunteer Form Route
app.post("/volunteer", async (req, res) => {
  try {
    await mailer.sendVolunteerMail(req.body);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// 7. Contact Form Route
app.post("/contact", async (req, res) => {
  try {
    await mailer.sendContactMail(req.body);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});