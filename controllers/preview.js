exports.index = function (req, res) {

  var lang = 'en';
  if (req.query.lang) {
    lang = req.query.lang;
  } else if (req.query.l) {
    lang = req.query.l;
  }

  var langFile;

  try {
    langFile = require('../i18n/' + lang + '.json');
  }
  catch (e) {
    console.log(e);
    langFile = require('../i18n/en.json');
  }

  res.render('preview/index', {
    title: 'Preview',
    langFile: langFile,
    success: false,
    message: 'User not found.'
  });
};
