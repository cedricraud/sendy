var folder = 'pictures',
    previewFolder = 'previews',
    thumbFolder = 'thumbnails',
    trashFolder = 'trash',
    root;

// Publications
Meteor.publish("pictures", function (page) {
  return Pictures.find({page: page});
});

Meteor.publish("pages", function (page) {
  return Pages.find({});
});

// Npm
var require = Npm.require,
    connect = require('connect'),
    Fiber = require('fibers'),
    Future = require('fibers/future'),
    fs = require('fs'),
    im = require('imagemagick'),
    mkdirp = require('mkdirp'),
    moment = require('moment'),
    slug = require('slug'),
    zipstream = require('zipstream');

// App
Meteor.startup(function () {
  // Say Hello
  log('Hi, I\'m Sendy');

  root = process.env.SENDY_PICTURES_PATH;

  if (root) {
      if (fs.existsSync(root)) {
      // Route Files
      RoutePolicy.declare('/files', 'network');
      WebApp.connectHandlers.use('/files', filesHandler(root));

      // Route Archives
      RoutePolicy.declare('/archive', 'network');
      WebApp.connectHandlers.use('/archive', archiveHandler);

      // Load pages
      log('Pages:');
      Meteor.loadPages();

      // Here we go!
      log('Ready!');
    } else {
      log('Error: SENDY_PICTURES_PATH is not a valid folder');
    }
  } else {
    log('Error: missing SENDY_PICTURES_PATH environment variable (absolute path to folder where the pictures will be stored');
  }

});

Meteor.loadPages = function() {
  Pages.find().forEach(function(page) {
    var path = process.env.SENDY_PICTURES_PATH + '/' + page.name;

    log('• ' + page.name + ' (' + Pictures.find({page: page.name}).count() + ' pics)');

    if (!fs.existsSync(path)) {
      log('Create missing folder: ' + page.name);
      mkdirp.sync(path);
      mkdirp.sync(path + '/' + folder);
      mkdirp.sync(path + '/' + previewFolder);
      mkdirp.sync(path + '/' + thumbFolder);
      mkdirp.sync(path + '/' + trashFolder);
    }
  });
};

var pathTo = function(page, folder, file) {
  return process.env.SENDY_PICTURES_PATH + '/' + page + '/' + folder + '/' + file;
};

var cleanPath = function(str) {
  if (str) {
    return str.replace(/\.\./g,'').replace(/\/+/g,'').
      replace(/^\/+/,'').replace(/\/+$/,'');
  }
};

var cleanName = function(str) {
  return str.replace(/\.\./g,'').replace(/\//g,'').replace(/"/g,'');
};

var log = function(message, page, author) {
  console.log((page ? '[' + ucwords(page) + ']' : '') +
    (author ? '[' + author + '] ' : ' ') +
    message);
};

var downThemAll = function(res, name, files) {
  var zip = zipstream.createZip({ level: 1 });
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-disposition', 'attachment;filename="' + name + '.zip"');
  zip.pipe(res);
  (function zipThemAll() {
    if (files.length > 0) {
      var filepath = files.shift();
      var file = filepath.substring(filepath.lastIndexOf('/') + 1);
      var filestream = fs.createReadStream(filepath);
      zip.addFile(filestream, { name: file, store: true }, zipThemAll);
    }
    else
      zip.finalize();
  })();
};

// Handlers
var filesHandler = function(path) {
  return connect.static(path, { maxAge: 86400000 });
};

var archiveHandler = function (req, res, next) {
    Fiber(function() {
      if(req.method == "GET"){
        var url = decodeURIComponent(req.url);
        var parts = url.split('/').map(function(item){return item.split('.');});
        var query = null;
        if(parts.length == 3 && parts[2].length == 2 && parts[2][1] == 'zip'){
          query = {page:parts[1][0], author:parts[2][0]};
        }
        if(parts.length == 2 && parts[1].length == 2 && parts[1][1] == 'zip'){
          query = {page:parts[1][0]};
        }
        if (query) {
          var files = [];
          var pictures = Pictures.find(query);

          log('Downloading: ' + (query.author ? query.author : 'Everything!'), query.page);

          pictures.forEach(function(picture) {
            files.push(pathTo(query.page, folder, picture.name));
          });

          downThemAll(res, ucwords(query.page) + (query.author ? '-' + query.author : ''), files);
        }
        else {
          next();
        }
      } else {
        next();
      }
    }).run();
};

// Methods
Meteor.methods({
  createPage: function(title) {
    var page = cleanName(title);

    if (page == 'public') {
      log('Forbidden page: ' + page);
      return false;
    } else if (Pages.findOne({name: page})) {
      log('Page already exists: ' + page);
      return false;
    } else {
      log('Creating ' + page);

      Pages.insert({name: page, title: title}, function() {
        Meteor.loadPages();
      });
      return page;
    }
  },

  deletePage: function(id) {
    Pages.remove(id);
  },

  renameAuthor: function(page, author, oldName, newName) {
    var fut = new Future();

    log('Renaming author ' + oldName + ' to ' + newName, page, author);

    Pictures.update({author: oldName, page: page}, {$set: {author: newName}}, {multi: true}, function() {
      fut.return();
    });

    return fut.wait();
  },

  rotateFile: function(page, author, name, id, orientation, direction) {
    var fut = new Future();
    var rotate = direction == 'right' ? '90' : '-90';

    log('Rotating ' + name + ' to ' + direction, page, author);

    orientation = orientation === 'v' ? 'h' : 'v';
    im.convert([pathTo(page, thumbFolder, name), '-rotate', rotate, '-quality', 100, pathTo(page, thumbFolder, name)], function(err, stdout){
      if (err) throw err;
      im.convert([pathTo(page, previewFolder, name), '-rotate', rotate, '-quality', 100, pathTo(page, previewFolder, name)], function(err, stdout){
      if (err) throw err;
        im.convert([pathTo(page, folder, name), '-rotate', rotate, '-quality', 100, pathTo(page, folder, name)], function(err, stdout){
          if (err) throw err;

          Fiber(function() {
            Pictures.update({_id: id}, {
              $set: {orientation: orientation},
              $inc: {v: 1}
            });
          }).run();

          fut.return();
        });
      });
    });
    return fut.wait();
  },

  deleteFile: function(page, author, name, id) {
    log('Deleting ' + name, page, author);

    fs.rename(pathTo(page, folder, name), pathTo(page, trashFolder, name));
    fs.unlink(pathTo(page, thumbFolder, name));
    fs.unlink(pathTo(page, previewFolder, name));

    Fiber(function() {
      Pictures.remove(id);
    }).run();
  },

  saveFile: function(page, author, name, blob, metadata) {
    var existingPicture;
    var fut = new Future();
    var encoding = 'binary';
    name = slug(cleanName(author + ' ' + (name || 'file')));

    // Picture received, fire the callback
    fut.return();

    // Rename picture if one already exists
    while ((existingPicture = Pictures.findOne({page: page, author: author, name: name}))) {
      var match;
      if ((match = name.match(/.+\(([0-9]+)\)/)) && match.length == 2) {
        name = name.replace('(' + match[1] + ')', '(' + (1 + parseInt(match[1], 10)) + ')');
      } else {
        name = name.substring(0, name.lastIndexOf('.')) + ' (1)' + name.substring(name.lastIndexOf('.'));
      }
    }

    // Store picture
    fs.writeFile(pathTo(page, folder, name), blob, encoding, function(err) {
      if (err) {
        throw (new Meteor.Error(500, 'Failed to save file.', err));
      } else {
        var thumbOptions = {
          srcPath: pathTo(page, folder, name),
          dstPath: pathTo(page, thumbFolder, name),
          quality: 0.9
        };
        var previewOptions = {
          srcPath: pathTo(page, folder, name),
          dstPath: pathTo(page, previewFolder, name),
          quality: 0.8
        };
        var orientation = 'h';

        log('Adding ' + name, page, author);
        console.log(JSON.stringify(metadata));
        console.log(metadata.width + ' - ' + metadata.height + ' - ' + metadata.date);

        if (metadata.width < metadata.height) {
          orientation = 'v';
          thumbOptions.width = 230;
          previewOptions.width = metadata.width < 960 ? metadata.width : 960;
        }
        else {
          thumbOptions.height = 230;
          previewOptions.height = metadata.height < 960 ? metadata.height : 960;
        }
        im.resize(thumbOptions, function(err) {
          if(err) throw err;

          // Add to database
          Fiber(function() {
            if (existingPicture) { // Deprecated
              log('Updating existing ' + name, page, author);
              Pictures.update({_id: existingPicture._id}, {
                $set: {orientation: orientation},
                $inc: {v: 1}
              });
            } else {
              Pictures.insert({
                name: name,
                page: page,
                author: author,
                date: metadata.date ? new Date(metadata.date) : new Date(),
                orientation: orientation,
                v: +new Date() % 10000
              });
            }
          }).run();

          im.resize(previewOptions, function(err) {
            if(err) throw err;

            // Image added
          });
        });
      }
    });
    return fut.wait();
  }
});
