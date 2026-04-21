const express = require('express');
const router = express.Router();

router.get(
  ['/ISAPI/ContentMgmt/record/status', '/ISAPI/ContentMgmt/record/status/'],
  (req, res) => {
    res
      .status(200)
      .type('application/xml')
      .send(
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<RecordingStatus>\n' +
          '    <status>true</status>\n' +
          '</RecordingStatus>'
      );
  }
);

module.exports = router;
