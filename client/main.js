var isHd = false,
    maxSize,
    quality;

// App
Router.map(function() {
  this.route('index', {path: '/'});
  this.route('admin', {
    waitOn: function () {
      $('.fancybox-overlay').animate({ 'opacity': 'hide'});
      $('body').scrollTop(0);
      return Meteor.subscribe('pages');
    },
    data: function() {
      return Pages.find({}, {sort: {name: 1}});
    }
  });
  this.route('page', {
    path: '/:page',
    waitOn: function() {
      var page = this.params.page;
      // Set Pictures upload settings
      document.title = ucwords(page);
      if ((isHd = !!location.href.match(/hd/i))) {
        document.title += ' (hd)';
      }
      maxSize = isHd ? 2500 : 960;
      quality = isHd ? 1 : 0.9;
      console.log('Hd:', isHd, 'Quality:', quality, 'MaxSize:', maxSize);

      // Filter by author
      Session.set('authorFilter', this.params.author);

      return [Meteor.subscribe('pictures', page), Meteor.subscribe('pages')];
    },
    data: function() {
      var page = Pages.findOne({name: this.params.page});
      Session.set('page', page ? page : { name: '', secret: 'loading' });

      // Admin
      Session.set('isAdmin', Session.get("page").secret == this.params.key);

      return Pictures.find({}, {sort: {author: 1, date: 1, name: 1}});
    }
  });
});

Meteor.startup(function () {
  console.log('App Started');
  if (!SendySession.get('mode'))
      SendySession.set('mode', 'small');
  Session.set('busy', false);
  Session.set('rendered', false);
  console.log('Author: ' + SendySession.get('author'));

  if (window.outerWidth < 485) {
    $('meta[name=viewport]').attr('content','width=485');
  }
});

// Toolkit
var SendySession = _.extend({}, Session, {
  keys: _.object(_.map(amplify.store(), function (value, key) {
    return [key, JSON.stringify(value)];
  })),
  set: function (key, value) {
    Session.set.apply(this, arguments);
    amplify.store(key, value);
  }
});

var getExifDate = function(value) {
  // YYYY:MM:DD HH:MM:SS -> Date(YYYY-MM-DD HH:MM:SS +0000)
  value = value.split(/ /);
  return new Date(value[0].replace(/:/g, '-') + ' ' + value[1] + ' +0000');
};

var optimizePicture = function(file, callback) {
  var megaImage = new MegaPixImage(file);

  console.log('Optimization started.');

  megaImage.imageLoadListeners.push(function() {
    var canvasNode = $('.canvas');
    if (canvasNode.length === 0) {
     canvasNode = $('<canvas class="canvas">');
      $('body').append(canvasNode);
    }
    var canvas = canvasNode[0];
    var date;
    var width = megaImage.srcImage.naturalWidth;
    var height = megaImage.srcImage.naturalHeight;

    if (width < height) {
      canvas.width = width < maxSize ? width : maxSize;
      canvas.height = height * canvas.width / width;
    }
    else {
      canvas.height = height < maxSize ? height : maxSize;
      canvas.width = width * canvas.height / height;
    }

    width = canvas.width;
    height = canvas.height;

    megaImage.onrender = function() {
      if (canvas.toBlob) {
        canvas.toBlob(function(blob) {
          callback(blob, { width: +canvasNode.attr('width'), height: +canvasNode.attr('height'), date: date.getTime() });
        }, 'image/jpeg');
      } else {
        alert('Mince, ton navigateur est trop vieux pour envoyer des images.');
      }
    };

    EXIF.getData(megaImage.srcImage, function() {
      if (EXIF.getTag(this, 'DateTimeOriginal')) {
        date = getExifDate(EXIF.getTag(this, 'DateTimeOriginal'));
      } else {
        date = new Date(file.lastModifiedDate.getTime());
      }
      console.log('Optimizing ', file, EXIF.pretty(this), typeof date);
      megaImage.render(canvas, {
        maxWidth: width,
        maxHeight: height,
        quality: quality,
        orientation: EXIF.getTag(this, 'Orientation')
      });
    });
  });
};

var expandAuthor = function(author) {
  Session.set('category-' + author, true);
};

Template.picture.helpers({
  pretty: function(date) {
    return moment(date).format('DD/MM');
  }
});

Template.picture.busy = function() {
  return Session.get('busy');
};

Template.picture.smallMode = function() {
  return SendySession.equals('mode', 'small') ? 'active' : '';
};

Template.picture.largeMode = function() {
  return SendySession.equals('mode', 'large') ? 'active' : '';
};

Template.picture.page = function() {
  return Session.get('page').name;
};

Template.picture.validationStatus = function() {
  return this.validated ? 'valid' : 'invalid';
};

Template.picture.validationIcon = function() {
  return this.validated ? 'icon-eye-open' : 'icon-eye-close';
};

Template.page.isAdmin = function() {
  return Session.get('isAdmin');
};

Template.page.isNotEmpty = function() {
  return Session.get('picturesCount');
};

Template.page.isWaitingForValidation = function() {
  return Session.get('uploadedCount') > Session.get('picturesCount') && !Session.get('busy');
};

Template.page.pageModePublic = function() {
  return Session.get('page').mode != 'validation' ? 'active' : '';
};

Template.page.pageModeValidation = function() {
  var validation = Session.get('page').mode == 'validation';

  $('body').toggleClass('validation', validation);
  return validation ? 'active' : '';
};

Template.page.pictures = function () {
  this.rewind();

  var results = [];
  var lastCategory = null;
  var categoryCount = 0;
  var categoryMax = 9;
  var categoryLength = this.count();
  var authorFilter = Session.get('authorFilter');
  var isAdmin = Session.get('isAdmin');
  var isValidated = Session.get('page').mode == 'validation';

  this.forEach(function(picture) {
    if ((!authorFilter && (isAdmin || (!isValidated || picture.validated))) || picture.author == authorFilter) {
      if (picture.author != lastCategory) {
        lastCategory = picture.author;
        picture.category = lastCategory;
        categoryCount = 0;
      }
      if (categoryCount < categoryMax) {
        results.push(picture);
        categoryCount++;
      } else if (authorFilter || Session.get('category-' + lastCategory)) {
        results.push(picture);
      } else if (categoryCount == categoryMax) {
        picture.loadMore = true;
        results.push(picture);
        categoryCount++;
      }
    }
  });

  Session.set('picturesCount', results.length);

  return results;
};

Template.page.helpers({
  ucwords: ucwords
});

Template.page.busy = function() {
  return Session.get('busy');
};

Template.page.progress = function() {
  return Session.get('progress');
};

Template.page.author = function () {
  return SendySession.get('author');
};

Template.page.email = function () {
  return SendySession.get('email');
};

Template.page.page = function() {
  return Session.get('page').name;
};

Template.page.mode = function() {
  return SendySession.get('mode');
};

Template.page.rendered = function() {
  if (!Session.get('rendered')) {
    console.log('FANCYBOX');
    $('.pictures a').fancybox();
    Session.set('rendered', true);
  }
  $('.pinned').pin();

  $('body').height('auto').height($(document).height()); // Fix jumps during render
  $(window).scroll(); // Fix the disappearing pinned element
  $(window).resize(); // Fix the stopping pinned element
};

Template.admin.helpers({
  ucwords: ucwords
});

// Events
Template.picture.events({
  'click': function(ev) {
    if (this.loadMore) {
      ev.preventDefault();
      ev.stopPropagation();
      expandAuthor(this.author);
    } else if (ev.ctrlKey || ev.metaKey) {
      window.open(ev.target.hash.replace('#', '/'));
      ev.stopPropagation();
      ev.preventDefault();
    }
  },
  'click button#delete': function(ev) {
    var asked = Session.get('asked');
    if(asked || confirm('Supprimer ' + this.name + ' ?')) {
      Meteor.deleteFile(this.name, this._id);
      Session.set('asked', true);
    }
    ev.preventDefault();
    ev.stopPropagation();
  },
  'click button#turn-left': function(ev) {
    if (Session.equals('busy', false)) {
      Session.set('progress', 100);
      Session.set('busy', 'Rotation de l\'image');
      Meteor.rotateFile(this.name, this._id, this.orientation, 'left', function(err, data) {
        if(err) throw err;

        Session.set('busy', false);
      }.bind(this));
    }
    ev.preventDefault();
    ev.stopPropagation();
  },
  'click button#turn-right': function(ev) {
    if (Session.equals('busy', false)) {
      Session.set('progress', 100);
      Session.set('busy', 'Rotation de l\'image');
      Meteor.rotateFile(this.name, this._id, this.orientation, 'right', function(err, data) {
        if(err) throw err;

        Session.set('busy', false);
      }.bind(this));
    }
    ev.preventDefault();
    ev.stopPropagation();
  },
  'click button#toggle-validation': function(ev) {
    Meteor.toggleValidation(this._id);
    ev.preventDefault();
    ev.stopPropagation();
  },
  'click button#large-mode': function(ev) {
    SendySession.set('mode', 'large');
  },
  'click button#small-mode': function(ev) {
    SendySession.set('mode', 'small');
  },
  'click .down': function(evt) {
    window.open($(evt.currentTarget).data('href'));
    evt.preventDefault();
    evt.stopPropagation();
  },
  'click button#rename': function(evt) {
    var name;
    if ((name = prompt('Renommer :', this.author)) && name.length >= 3) {
      Meteor.renameAuthor(this.author, name);
    }
  }
});

Template.page.events({
  'keyup #name': function(evt) {
    $('form').removeClass('error');
  },
  'click .add': function(evt) {
    if (!$('#user-name, #user-email').is(':visible')) {
      $('#user-name, #user-email').animate({ width: 'show' }, 100);
      $('#user-name').focus();
      $('a.download').animate({ width: 'hide' }, 100);
      evt.preventDefault();
    }
    else {
      var name = $('#user-name').val();
      var email = $('#user-email').val();
      if (name.length >= 3 && email.length >= 3) {
        SendySession.set('author', name);
        SendySession.set('email', email);
        $('#user-name, #user-email').animate({ width: 'hide' }, 100);
        $('a.download').animate({ width: 'show' }, 100);
      } else {
        alert('Le nom ou l\'email est invalide');
        evt.preventDefault();
      }
    }
  },
  'click .edit': function(evt) {
    $('body').toggleClass('edit');
  },
  'click .download': function(evt) {
    window.open($(evt.currentTarget).attr('href'));
    evt.preventDefault();
    evt.stopPropagation();
  },
  'change #files': function(evt) {
    var upload = function(files, index) {
      if (index >= files.length) {
        // The end.
        Meteor.finalizeUpload(files.length);
        Session.set('uploadedCount', files.length);
        Session.set('busy', 'Envoi terminé.');
        Session.set('progress', 100);
        setTimeout(function() {
          Session.set('busy', false);
          Session.set('rendered', false);
          $('body').removeClass('upload');
        }, 2000);
      } else {
        var file = files[index];
        if (file.type === 'image/jpeg' || file.type === 'image/png') {
          console.log('Uploading picture: ', file.name);
          Session.set('busy', 'Envoi des images : ' + (index + 1) + '/' + files.length);
          Session.set('progress', 10 + (index / files.length) * 90);
          optimizePicture(file, function(blob, metadata) {
            Meteor.saveFile(file.name, blob, metadata, function(error, data) {
              console.log('Uploaded picture: ', file.name);
              setTimeout(function() { upload(files, index + 1); }, 300);
            });
          });
        }
        else {
          console.log('Invalid picture extension: ', file.name);
          upload(files, index + 1);
        }
      }
    };
    upload(evt.target.files, 0);
    Session.set('category-' + SendySession.get('author'), true);
    $('body').addClass('upload').scrollTop(0);
  },
  'click button#page-mode-public': function(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    Meteor.setPageMode('public');
  },
  'click button#page-mode-validation': function(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    Meteor.setPageMode('validation');
  },
});

Template.admin.events({
  'click .create': function(evt) {
    if ($('input#page').val().length >= 3) {
      var email = $('input#email').val();
      var page = $('input#page').val().toLowerCase();
      if (email.length < 5 || page.length < 3) {
        return;
      }
      Meteor.createPage(page, email, function(error, name) {
        if (!name) {
          alert('Cette galerie existe déjà.');
        }
      });
      $('input').val('');
    }
    evt.stopPropagation();
    evt.preventDefault();
  },
  'click button.delete': function(evt) {
    if (confirm('Supprimer ' + this.name + ' ?')) {
      Meteor.deletePage(this._id);
    }
    evt.stopPropagation();
    evt.preventDefault();
  }
});

// Callbacks
Meteor.createPage = function(page, email, callback) {
  Meteor.call('createPage',
              page,
              email,
              callback);
};

Meteor.deletePage = function(id) {
  Meteor.call('deletePage',
              id,
              function(error, data) {
    // great
  });
};

Meteor.setPageMode = function(mode) {
  Meteor.call('setPageMode',
              Session.get('page').name,
              mode,
              function(error, data) {
    // great
  });
};

Meteor.renameAuthor = function(oldName, newName) {
  Meteor.call('renameAuthor',
              Session.get('page').name,
              SendySession.get('author'),
              oldName,
              newName,
              function(error, data) {
    // awesome
  });
};

Meteor.toggleValidation = function(id) {
  Meteor.call('toggleValidation',
              id,
              function(error, data) {
    // mega cool
  });
};

Meteor.rotateFile = function(name, id, orientation, direction, callback) {
  Meteor.call('rotateFile',
              Session.get('page').name,
              SendySession.get('author'),
              name,
              id,
              orientation,
              direction,
              callback);
};

Meteor.deleteFile = function(name, id) {
  Meteor.call('deleteFile',
              Session.get('page').name,
              SendySession.get('author'),
              name,
              id);
};

Meteor.saveFile = function(name, blob, metadata, callback) {
  var fileReader = new FileReader();

  fileReader.onload = function(file) {
    Meteor.call('saveFile',
                Session.get('page').name,
                SendySession.get('author'),
                name,
                file.target.result,
                metadata,
                callback);
  };

  fileReader.readAsBinaryString(blob);
};

Meteor.finalizeUpload = function(count) {
  Meteor.call('finalizeUpload',
            Session.get('page').name,
            SendySession.get('author'),
            SendySession.get('email'),
            count);
};
