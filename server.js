const compression = require('compression');
const bodyParser = require('body-parser')
const express = require('express');
const app = express();
const stripe = require('stripe')(process.env.stripe_secret_key);
const stripePriceId = process.env.stripe_price_id;
const port = process.env.PORT || 8080;
const firebase_admin_cert_text = process.env.admin_cert_text;
const force_https_redirect = process.env.force_https_redirect === "true";

const {initializeApp, getApp, cert,} = require('firebase-admin/app');
const {getFirestore} = require("firebase-admin/firestore");


const firebaseApp = initializeApp({credential: cert(JSON.parse(firebase_admin_cert_text))});
const db = getFirestore(firebaseApp);

const firebaseUpdateStripeStatus = async (uid, status) => {
  const documentRef = db.collection("user-profiles").doc(uid);
  await documentRef.update({
    stripeStatus: status
  });
}


app.use(async (req, res, next) => {
  throw new Error(`Test: ${req.headers.host}, ${req.url}, ${req.secure}, ${req.protocol}`)
  if (force_https_redirect && !req.secure) {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
})

app.use(compression());
app.use(express.static(__dirname));

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

app.post('/create-checkout-session', async (req, res) => {
  const {uid, email} = req.body;
  const url = `${req.protocol}://${req.headers.host}`;
  const session = await stripe.checkout.sessions.create({
    customer_email: email,
    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${url}/callback-success/${uid}`,
    cancel_url: `${url}/callback-cancel/${uid}`,
  });
  await firebaseUpdateStripeStatus(uid, "awaiting");

  res.json({redirect: session.url});
});

app.get('/callback-success/:uid', async (req, res) => {
  const {uid} = req.params;
  await firebaseUpdateStripeStatus(uid, "paid");
  res.redirect(303, "/success");
});

app.get('/callback-cancel/:uid', async (req, res) => {
  const {uid} = req.params;
  await firebaseUpdateStripeStatus(uid, "cancelled");
  res.redirect(303, "/cancel");
});

app.listen(port);
console.log(`Server listening on ${port}`);
