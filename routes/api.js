'use strict';

var expect = require('chai').expect;

let mongodb = require('mongodb')
let mongoose = require('mongoose')


mongoose.connect(process.env.DB, { useUnifiedTopology: true, useNewUrlParser: true }, (err, db) => {
  if (err) return console.log(err);
  console.log('Successful database connection.');
  });

const issueSchema = new mongoose.Schema({
  issue_title: { type: String, required: true },
  issue_text: { type: String, required: true },
  created_on: { type: Date, default: new Date().toUTCString() },
  updated_on: { type: Date, default: new Date().toUTCString() },
  created_by: { type: String, required: true },
  assigned_to: { type: String, default: '' },
  open: { type: Boolean, required: true, default: true },
  status_text: { type: String, default: ''}
});

let issueModel = mongoose.model('issue', issueSchema);

const projectSchema = new mongoose.Schema({
  project: String,
  issues: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "issue"
    }
  ]
});
let projectModel = mongoose.model('project', projectSchema);

module.exports = function (app) {

  app.route('/api/issues/:project')
  
    .get(function (req, res){
      let project = req.params.project;
      const { issue_title, issue_text, created_by, assigned_to, status_text, open } = req.query;
      projectModel.findOne({ project })
      .populate('issues')
      .exec((err, proj) => {
        if (err) return console.log(err);
        if (Object.keys(req.query).length === 0) {
          if (proj == null) {
            console.log("should create new projectModel");
            projectModel.create({ project }, (err, newProj) => {
              if (err) return console.log(err);
              return res.json(newProj.issues);
            });
          }
          if (proj) return res.json(proj.issues);
        } else {
          Object.keys(req.query).forEach((key) => {
            proj.issues = proj.issues.filter(issue => (issue[key] == req.query[key]));
          });
          return res.json(proj.issues);
        }
      });
    })
    
    .post(function (req, res){
      let project = req.params.project;
      if (!req.body.issue_title || !req.body.issue_text || !req.body.created_by) {
        return res.json({ error: 'required field(s) missing' })
      }
      projectModel.findOne({ project }, (err, foundProj) => {
        if (err) return console.log(err);
        let issueObj = {
          issue_title: req.body.issue_title,
          issue_text: req.body.issue_text,
          created_by: req.body.created_by,
          assigned_to: req.body.assigned_to,
          status_text: req.body.status_text,
        }
        if (foundProj) {
          issueModel.create(issueObj, (err, issue) => {
            if (err) return console.log(err);
            foundProj.issues.push(issue);
            foundProj.save((err, savedProj) => {
              if (err) return console.log(err);
              return res.json(issue);
            });
          });
        } else {
          projectModel.create({ project }, (err, newProj) => {
            if (err) return console.log(err);
            issueModel.create(issueObj, (err, issue) => {
              if (err) return console.log(err);
              newProj.issues.push(issue);
              newProj.save((err, savedProj) => {
                if (err) return console.log(err);
                return res.json(issue);
              })
            })
          })
        }
      });
    })

    .put(function (req, res){
      let updateObj = {};
      Object.keys(req.body).forEach((key) => {
        if (req.body[key] != '') {
          updateObj[key] = req.body[key];
        }
      });
      if (!req.body._id) {
        return res.json({ error: 'missing _id' });
      }
      if (Object.keys(updateObj).length < 2) {
        return res.json({ error: 'no update field(s) sent', '_id': req.body._id });
      };
      console.log('updateObj: ' + updateObj.id)
      updateObj['updated_on'] = new Date().toUTCString();
      issueModel.findByIdAndUpdate(req.body._id, updateObj, { new: true }, (error, updatedIssue) => {
        if (updatedIssue) {
          return res.json({ result: 'successfully updated', '_id': req.body._id });
        } else {
          return res.json({ error: 'could not update', '_id': req.body._id });
        }
      });
    })
    
    .delete(function (req, res){
      const { _id } = req.body;
      if (!_id) { return res.json({ error: 'missing _id' }); }
      issueModel.findByIdAndRemove(_id, (err, removedIssue) => {
        if (err || !removedIssue) {
          return res.json({ error: 'could not delete', '_id': _id });
        } 
        return res.json({ result: 'successfully deleted', '_id': _id });
      });
    });
};
