# Sendy

[Sendy](http://sendy.io:2013) is the easiest way to share pictures between friends.

Sendy is built with [Meteor](http://www.meteor.com) and can be easily deployed on a private web server.

## Requirements

- [Node.js](http://nodejs.org)
- [Meteor](https://www.meteor)
- [Meteorite](https://github.com/oortcloud/meteorite)
- [Image Magick](http://www.imagemagick.org)

## Installation

Clone the repository, declare the path to the pictures, then simply launch the app:

```
$ git clone https://github.com/cedricraud/sendy.git
$ cd sendy
$ export SENDY_PICTURES_PATH=<absolute_path_to_upload_folder>
$ export SENDY_MAILER_EMAIL=<gmail_email_of_sender>
$ export SENDY_MAILER_PASSWORD=<gmail_password_of_sender>
$ export SENDY_HOST=<public_host_of_app>
$ mrt
```

Meteorite will setup Meteor automatically and install all the dependencies of the app.

## Changelog

0.8 “Wedding”

* Admin mode!
* Emails!
* Filter a page by author (via url ?author=name)

0.7

* New name for the app: Berlin is now Sendy! “Hi Sendy!”
* Migrate from Meteor 0.6.2 to 0.6.5
* Better client/server architecture
* Use packages.json to declare npm dependencies
* Replace Router by IronRouter
* Improve logs
* Clean all the mess

0.6

* New Flat Design
* New Home Page to create pages
* Less form inputs

0.5

* Responsive Design
* Client-side resizing & auto-orient
* Better upload speed (no more auto-orient & identify on server)
* Fix upload on mobile (rename the picture if one already exists)
* We can now rename authors in edit mode
* Improve first time upload experience (prompt to enter firstname)
* ?hd option (bigger size & better quality)
* Known bug: date is strippped from exif tag on ios...

0.4

* New upload experience, with preview
* Compress picture on client-side
* Make database calls on server-side
* Improve display on iphone
* Fix small images sizing

0.3

* We can now create Pages ! (go to /admin)
* We can also download zip archives !
* Updated button layout
* Sort is preserved when uploading new files

0.2

* Edit mode
* Only 20 pictures are now diplayed by default (show more button)
* Huge speed improvement (better fancybox integration, meteor 0.6.2)
* Fix upload button on Firefox
* No more flickering of the author banner & improved positionning
* No more flickering of the whole page when entering nickname
* No more scroll hacks

0.1

* Choose a nickname and upload pictures
* Download all pictures at once
* Open pictures in fullscreen
* Rotate and delete indivisual pictures
* The author is always displayed on screen
* Big / Small display mode
