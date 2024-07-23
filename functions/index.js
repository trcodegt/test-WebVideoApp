const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors');

admin.initializeApp();

const corsOptions = {
  origin: true,
  credentials: true
};

exports.createCall = functions.https.onRequest((req, res) => {
  cors(corsOptions)(req, res, async () => {
    const firestore = admin.firestore();
    const callData = req.body;

    try {
      const callDoc = await firestore.collection('calls').add(callData);
      res.status(200).send({ id: callDoc.id });
    } catch (error) {
      console.error('Error creating call:', error);
      res.status(500).send({ error: error.message });
    }
  });
});

exports.answerCall = functions.https.onRequest((req, res) => {
  cors(corsOptions)(req, res, async () => {
    const firestore = admin.firestore();
    const { callId, answer } = req.body;

    try {
      const callDoc = firestore.collection('calls').doc(callId);
      await callDoc.update({ answer });
      res.status(200).send('Call answered');
    } catch (error) {
      console.error('Error answering call:', error);
      res.status(500).send({ error: error.message });
    }
  });
});

exports.addCandidate = functions.https.onRequest((req, res) => {
  cors(corsOptions)(req, res, async () => {
    const firestore = admin.firestore();
    const { callId, collectionName, candidate } = req.body;

    try {
      const candidateDoc = await firestore.collection(`calls/${callId}/${collectionName}`).add(candidate);
      res.status(200).send({ id: candidateDoc.id });
    } catch (error) {
      console.error('Error adding candidate:', error);
      res.status(500).send({ error: error.message });
    }
  });
});
