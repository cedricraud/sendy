var privateUrl = function(path, query) {
  return Meteor.absoluteUrl(encodeURIComponent(path) + (query ? '?' + query : ''), { replaceLocalhost: true });
};

var publicUrl = function(path, query) {
  return 'http://' + host + '/' + encodeURIComponent(path) + (query ? '?' + query : '');
};

sayCheese = function(page, author, callback) {
  phantom.create(function(ph) {
    ph.createPage(function(p) {
      //p.set('viewportSize', { width: 950 });
      p.set('settings.webSecurityEnabled', false);
      p.open(privateUrl(page, 'author=' + encodeURIComponent(author)), function(status) {
        setTimeout(function() {
          log('Taking Screenshot', page, author);
          p.evaluate(function() {
            //$('body').width(900);
            $('body').addClass('screenshot');
          });
          p.render(root + '/' + page + '/screenshot.png');
          ph.exit();
          callback();
        }, 500);
      });
    });
  });
};

sendFinalizeUploadMail = function(to, page, author, email, count) {
  if (smtp) {
    sayCheese(page, author, function() {
      var s = count > 1 ? 's' : '',
        amount = count > 1 ? count : 'une',
        html = '<body style="margin: 0px; padding: 0px;">'
          + author + ' (' + email + ') vient d\'ajouter ' + amount + ' photo' + s
          + ' à la galerie : ' + publicUrl(page) + '<br><br>'
          + '<table bgcolor="#F1F1F1" width="100%" margin="0"><tr><td align="center">'
          + '<img src="' + Meteor.absoluteUrl('files/' + encodeURIComponent(page) + '/screenshot.png')+ '">'
          + '</td></tr></table></body>';

      log('Sending email to ' + to, page, author);

      smtp.sendMail({
        subject: author + ' vient d\'ajouter ' + amount + ' nouvelle' + s + ' photo' + s,
        from: 'Sendy <' + smtpOptions.user + '>',
        to: to,
        html: html,
        forceEmbeddedImages: true
      }, function(err, message) {
        if (!err) log('Email sent!', page, author);
      });
    });
  }
};

sendCreatePageMail = function(email, page, title, secret) {
  if (smtp) {
    var html = 'Vous pouvez partager cette url à vos amis : ' + publicUrl(page)
     + '<br><br>'
    + 'La page d\'administration qui permet de modifier ou filtrer les photos est '
    + 'disponible à cette url (conservez la précieusement) : ' + publicUrl(page,  'key=' + secret)
    + '<br><br>'
    + 'Have fun !';

    smtp.sendMail({
      subject: 'Votre galerie « ' + title + ' » vient d\'être créée',
      from: 'Sendy <' + smtpOptions.user + '>',
      to: email,
      html: html
    });
  }
};