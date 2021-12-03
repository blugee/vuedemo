//utilizing require to keep a single instance of agenda

const Agenda = require('agenda');
const agenda = new Agenda({db: {address: process.env.MONGODB || process.env.MONGOLAB_URI}});

const nodemailer = require('nodemailer');
const sparkPostTransport = require('nodemailer-sparkpost-transport');
const Revision = require('../models/Revision');


(async () => {
  await agenda.start();
  agenda.define('sendPublicDesignEmail', (job, done) => {

    let getRevision = async () => {
      let revision = await Revision.findById(job.attrs.data.revisionID);
      if (!revision) {
        let err = new Error('cannot find revision');
        return Promise.reject(err);
      }
      return revision;
    }

    getRevision().then(r => {
      r.publicDesign.isSent = true;
      r.save().then(savedRev => {
        var userTransporter = nodemailer.createTransport(
          sparkPostTransport({
            "options": {
              "open_tracking": true,
              "click_tracking": true,
              "transactional": true
            },
            "campaign_id": "public-design-initial-email",
            "metadata": {
              "reason": "public-design-initial-email"
            },
            "substitution_data": {
              "FIRST_NAME": job.attrs.data.name.first,
              "ORDER_NUMBER": job.attrs.data.orderNumber,
              "DESIGN_TYPE": job.attrs.data.caseType,
              "FILE_ID": job.attrs.data.fileID
            },
            "content": {
              "template_id": "public-design-initial-email"
            }
          })
        );
        userTransporter.sendMail({
          "recipients":
            [{
              "address": {
                "email": job.attrs.data.owner.email
              }
            }
            ]
        }).catch(function (err) {
          rollbar.error(err);
          console.error(err);
        });
        done();
      })
    }, err => {
      rollbar.error(err);
      console.error(err);
    });
  });
})()
module.exports = agenda;
