// curriculum.js
// Router for academic curriculum lookup by grade level in GlobyEdu OS.

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Load curriculum data from the JSON database.
function loadCurriculumData() {
  const filePath = path.join(__dirname, '../data/curriculum.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(raw);
  return json.curriculum || {};
}

// GET /api/v1/curriculum/:grade
// Uses the URL parameter :grade to return curriculum details for a grade level.
// Example: /api/v1/curriculum/JHS1
router.get('/:grade', (req, res) => {
  const grade = req.params.grade;

  // Express uses the route path segment :grade to capture the actual grade value
  // from the incoming URL. For example, if the client requests /api/v1/curriculum/JHS1,
  // then req.params.grade will be 'JHS1'.
  const curriculum = loadCurriculumData();
  const subjects = curriculum[grade];

  if (!subjects) {
    return res.status(404).json({
      status: 'error',
      message: `Curriculum not found for grade: ${grade}`,
    });
  }

  res.json({
    status: 'ok',
    grade,
    subjects,
  });
});

module.exports = router;
