/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true,
   strict:true, undef:true, unused:true, curly:true, browser:true, white:true,
   moz:true, esnext:false, indent:2, maxerr:50, devel:true, node:true, boss:true,
   globalstrict:true, nomen:false, newcap:false */

'use strict';

var deferred = require('deferred');
var mongoose = require('mongoose');

var bugzilla = require('./api-bugzilla');
var error = require('./api-utils').error;
var extend = require('./api-utils').extend;

var BugInfo = mongoose.model('BugInfo', new mongoose.Schema({
  number: {type: String, required: "BugInfo must have a number"},
  summary: String,
  status: String,
  resolution: String,
  blocking: String,
  assigned: String,
  last_got: Date
}));

var bugSchema = new mongoose.Schema({
  number: {type: String, required: "Bug must have a number"},
  startX: {type: Number, required: "Bug must have and startX"},
  startY: {type: Number, required: "Bug must have and startY"},
  endX: {type: Number, required: "Bug must have and endX"},
  endY: {type: Number, required: "Bug must have and endY"},
  mockup: {type: String, required: "Bug must have a mockup"}
});
var Bug = mongoose.model('Bug', bugSchema);

var Theme = mongoose.model('Theme', new mongoose.Schema({
  name: {type: String, unique: true, required: 'Theme name required.'}
}));

var Product = mongoose.model('Product', new mongoose.Schema({
  name: {type: String, unique: true, required: 'Product name required.'}
}));

var mockupSchema = new mongoose.Schema({
  name: {type: "string", required: 'Mockup must have name'},
  slug: {type: String, required: 'Mockup must have a slug'},
  archived: {type: "boolean", required: "Mockup must specify if it's archived", default: false},
  image: {data: Buffer, contentType: String},
  creationDate: { type: Date, default: Date.now },
});
var Mockup = mongoose.model('Mockup', mockupSchema);

var projectSchema = new mongoose.Schema({
  name: {type: String, required: 'Project name required.'},
  slug: {type: String, unique: true, required: 'Project must have a slug'},
  archived: {type: "boolean", required: "Project must specify if it's archived", default: false},
  creationDate: {type: Date, default: Date.now },
  user: {type: String, required: 'Project must have a user.'},
  themes: [{type: mongoose.Schema.ObjectId, ref: 'Theme'}],
  products: [{type: mongoose.Schema.ObjectId, ref: 'Product'}],
  mockups: {type: [mockupSchema]}
});
var Project = mongoose.model('Project', projectSchema);



var BUGZILLA_FETCH_DELAY = 4 * 60 * 60 * 1000; // 4 hours.

// Themes
exports.getThemes = function (req, res) {
  return Theme.find(function (err, themes) {
    if (err) {
      return error(res, err, console);
    }
    return res.json(themes);
  });
};

exports.postTheme = function (req, res) {
  if (!req.session.email) {
    return error(res, 'Not logged in.');
  }
  var theme = new Theme(req.body);
  theme.save(function (err) {
    if (err) {
      return error(res, err, console);
    }
    return res.json(theme);
  });
};

exports.putTheme = function(req, res) {
  if (!req.session.email) {
    return error(res, 'Not logged in.');
  }
  Theme.findById(req.params.theme_id, function(err, theme) {
    if (err) {
      return error(res, err, console);
    }

    theme.name = req.body.name;

    theme.save(function (err) {
      if (err) {
        return error(res, err, console);
      }
      res.json(theme);
    });
  });
};

exports.deleteTheme = function(req, res) {
  if (!req.session.email) {
    return error(res, 'Not logged in.');
  }
  Theme.findById(req.params.theme_id, function(err, theme) {
    if (err) {
      return error(res, err, console);
    }

    theme.remove();

    res.json(theme);
  });
};

// Products
exports.getProducts = function (req, res) {
  return Product.find(function (err, products) {
    if (err) {
      return error(res, err, console);
    }
    return res.json(products);
  });
};

exports.postProduct = function (req, res) {
  if (!req.session.email) {
    return error(res, 'Not logged in.');
  }
  var product = new Product(req.body);
  product.save(function (err) {
    if (err) {
      return error(res, err, console);
    }
    return res.json(product);
  });
};

exports.putProduct = function(req, res) {
  if (!req.session.email) {
    return error(res, 'Not logged in.');
  }
  Product.findById(req.params.product_id, function(err, product) {
    if (err) {
      return error(res, err, console);
    }

    product.name = req.body.name;

    product.save(function (err) {
      if (err) {
        return error(res, err, console);
      }
      res.json(product);
    });
  });
};

exports.deleteProduct = function(req, res) {
  if (!req.session.email) {
    return error(res, 'Not logged in.');
  }
  Product.findById(req.params.product_id, function(err, product) {
    if (err) {
      return error(res, err, console);
    }

    product.remove();

    res.json(product);
  });
};

// Projects.

exports.getProjects = function (req, res) {
  return Project.find()
  .populate('themes products')
  .select('-mockups.image') // don't get the mockup image
  .exec(function(err, projects) {
    if (err) {
      return error(res, err, console);
    }
    return res.json(projects);
  });
};

exports.postProject = function (req, res) {
  if (!req.session.email) {
    return error(res, 'Not logged in.');
  }

  saveUnsaved(req.body.products, Product, function(products) {
    req.body.products = products.map(function(product) {return product._id;});
    saveUnsaved(req.body.themes, Theme, function(themes) {
      req.body.themes = themes.map(function(theme) {return theme._id;});
      req.body.user = req.session.email;
      var project = new Project(req.body);
      project.save(function (err) {
        if (err) {
          return error(res, err, console);
        }
        project.populate({path: 'themes products'}, function(err, project) {
          if (err) {
            return error(res, err, console);
          }
          return res.json(project);
        });
      });
    });
  });
};

exports.putProject = function (req, res) {
  if (!req.session.email) {
    return error(res, 'Not logged in.');
  }

  Project.findById(req.body._id, function (err, project) {
    if (err) {
      return error(res, err, console);
    }

    if (!project) {
      return error(res, "No project with id: " + req.params.project_id);
    }

    if (project.user !== req.session.email) {
      return error(res, 'Cannot modify project you did not create.');
    }

    project.name = req.body.name;
    project.mockups = req.body.mockups;
    project.archived = req.body.archived;
    saveUnsaved(req.body.products, Product, function(products) {
      project.products = products.map(function(product) {return product._id;});
      saveUnsaved(req.body.themes, Theme, function(themes) {
        project.themes = themes.map(function(theme) {return theme._id;});

        project.save(function (err) {
          if (err) {
            return error(res, err, console);
          }
          project.populate({path: 'themes products'}, function(err, project) {
            if (err) {
              return error(res, err, console);
            }
            return res.json(project);
          });
        });
      });
    });
  });
};

exports.getProject = function (req, res) {
  return Project.findById(req.params.project_id, function (err, project) {
    if (err) {
      return error(res, err, console);
    }

    if (!project) {
      return error(res, 'No project with id: ' + req.params.project_id);
    }

    return res.json(project);
  });
};

exports.deleteProject = function (req, res) {
  if (!req.session.email) {
    return error(res, 'Not logged in.');
  }
  Project.findOne({_id: req.params.project_id}, function (err, project) {
    if (project.user !== req.session.email) {
      return error(res, 'Cannot delete a project you didn’t create!');
    }

    project.mockups.forEach(function (mockup) {
      Bug.find({mockup: mockup._id}).remove();
    });

    // Delete the project itself!
    Project.findOneAndRemove({_id: req.params.project_id}, function (err, project) {
      if (err) {
        return error(res, err, console);
      }
      return res.json(project);
    });
  });
};

exports.getMockupImg = function(req, res) {
  Project.findOne({_id: req.params.project_id}, function (err, project) {
    if (!project) {
      return error(res, "No project with id: " + req.params.project_id);
    }
    var mockup = project.mockups.id(req.params.mockup_id);

    if (!mockup) {
      return error(res, "No mockup with id: " + req.params.mockup_id);
    }

    return res.json({data: mockup.image});
  });
};

exports.getMockup = function (req, res) {
  Project.findOne({_id: req.params.project_id}, function (err, project) {

    if (err) {
      return error(res, err, console);
    }

    if (!project) {
      return error(res, "No project with id: " + req.params.project_id);
    }

    var mockup = project.mockups.id(req.params.mockup_id);
    if (!mockup) {
      return error(res, "No mockup with id: " + req.params.mockup_id, console);
    }
    return res.json(mockup);
  });
};

exports.postMockup = function (req, res) {
  if (!req.session.email) {
    return error(res, 'Not logged in.');
  }

  Project.findOne({_id: req.params.project_id}, function (err, project) {
    if (err) {
      return error(res, err, console);
    }

    if (!project) {
      return error(res, 'Project not found for id: ' + req.params.project_id);
    }

    if (project.user !== req.session.email) {
      return error(res, 'Cannot add a mockup to a project you didn’t create!');
    }

    var mockup = new Mockup(req.body);
    project.mockups.push(mockup);
    project.save(function(err) {
      if (err) {
        return error(res, err, console);
      }
      return res.json(project.mockups.id(mockup._id));
    });
  });
};

exports.putMockup = function (req, res) {
  if (!req.session.email) {
    return error(res, 'Not logged in.');
  }

  Project.findById(req.params.project_id, function (err, project) {
    if (!project) {
      return error(res, 'No project with id: ' + req.params.project_id);
    }

    if (project.user !== req.session.email) {
      return error(res, 'Cannot update a mockup in a project you didn’t create!');
    }
    var mockup = project.mockups.id(req.params.mockup_id);

    if (!mockup) {
      return error(res, 'No mockup with id: ' + req.params.mockup_id);
    }

    if (req.body.archived !== undefined) {
      mockup.archived = req.body.archived;
    }

    mockup.name = req.body.name || mockup.name;
    mockup.image = req.body.image || mockup.image;
    mockup.bugs = req.body.bugs || mockup.bugs;
    project.save(function(err) {
      if (err) {
        return error(res, err, console);
      }
      return res.json(project.mockups.id(req.params.mockup_id));
    });
  });
};

exports.deleteMockup = function (req, res) {
  if (!req.session.email) {
    return error(res, 'Not logged in.');
  }
  Mockup.findOne({_id: req.params.mockup_id}, function (err, mockup) {
    Project.findOne({_id: mockup.project}, function (err, project) {
      if (project.user !== req.session.email) {
        return error(res, 'Cannot delete a project you didn’t create!');
      }

      // Delete all the bugs for this mockup.
      Bug.find({mockup: req.params.mockup_id}).remove();

      // Delete the mockup itself!
      Mockup.findOneAndRemove({_id: req.params.mockup_id}, function (err, mockup) {
        if (err) {
          return error(res, err, console);
        }
        return res.json(mockup);
      });
    });
  });
};


// Bugs.

var makeFullBug = function (bug, bugInfo) {
  var retval = {};
  if (bug.toObject) {
    bug = bug.toObject();
  }
  if (bugInfo.toObject) {
    bugInfo = bugInfo.toObject();
  }
  extend(retval, bugInfo, bug);
  return retval;
};

var getBugzillaInfo = function (bug, bugInfo) {
  var def = deferred();
  if (bugInfo.last_got && Date.now() - bugInfo.last_got.getTime() < BUGZILLA_FETCH_DELAY) {
    console.log('Too soon to fetch bug data for', bug.number);
    setTimeout(function () {
      def.resolve(makeFullBug(bug, bugInfo));
    }, 0);
    return def.promise;
  }
  bugzilla.getBug(bug.number, function (err, response, body) {
    body = body.bugs[0];
    var bugzillaInfo = {};
    if (!body) {
      def.resolve(new Error("Could not get bug"));
    } else {
      if (!err && response.statusCode === 200) {
        bugzillaInfo = bugzilla.getInfo(body);
      }
      if (bugzillaInfo.number) {
        var bugInfo = new BugInfo(bugzillaInfo);
        bugInfo.save(function () {
          def.resolve(makeFullBug(bug, bugInfo));
        });
      } else {
        // Figure out how to handle errors.
        // The form is: { error: true, code: 102, message: 'Access Denied' }
        // At the least, we need to remove the bug from the db.
        // Or do we?  For now, let's return the error, and filter it out.
        def.resolve(makeFullBug(bug, body));
      }
    }
  });
  return def.promise;
};

var addBugInfos = function (bugs, callback) {
  var bugNumbers = bugs.map(function (bug) {
    return bug.number;
  });
  BugInfo.find({number: {$in: bugNumbers}}, function (err, bugInfos) {
    if (err) {
      console.error(err);
    }
    deferred.map(bugs, function (bug) {
      var bugInfo = bugInfos.filter(function (bugInfo) {
        return bugInfo.number === bug.number;
      });
      bugInfo = bugInfo.length ? bugInfo[0].toObject() : {};
      // Kick off a bugzilla request.
      return getBugzillaInfo(bug, bugInfo);
    }).then(function (result) {
      result = result.filter(function (bug) {
        return !bug.error;
      });
      callback(null, result);
    }, function (response) {
      console.log('addBugInfos 5 Error:', response);
      callback(response, null);
    });
  });
};


function returnBugsForMockups(mockups, res) {
  return Bug.find({mockup: {$in: mockups}}, function (err, bugs) {
    if (err) {
      return error(res, err, console);
    }
    addBugInfos(bugs, function (err, bugs) {
      if (err) {
        return res.json(err);
      }
      return res.json(bugs);
    });
  });
}

exports.getBugs = function (req, res) {
  if (!req.params.mockup_id && !req.params.project_id) {
    Bug.find(function (err, bugs) {
      addBugInfos(bugs, function(err, bugs) {
        if (err) {
          return error(res, err, console);
        }

        return res.json(bugs);
      });
    });
  }

  if (req.params.mockup_id) {
    return returnBugsForMockups([req.params.mockup_id], res);
  } else if (req.params.project_id) {
    return Mockup.findById(req.params.project_id, function (err, mockups) {
      if (err) {
        return error(res, err, console);
      }

      var keys = mockups.map(function (mockup) {
        return mockup._id;
      });
      return returnBugsForMockups(keys, res);
    });
  }
};


exports.postBug = function (req, res) {
  if (!req.session.email) {
    return error(res, 'Not logged in.');
  }

  Project.findById(req.params.project_id, function (err, project) {
    if (!project) {
      return error(res, 'No project with id: ' + req.params.project_id);
    }

    if (project.user !== req.session.email) {
      return error(res, 'Cannot add a bug to a project you didn’t create!');
    }

    req.body.mockup = req.params.mockup_id;

    var bug = new Bug(req.body);
    bug.save(function (err) {
      if (err) {
        return error(res, err, console);
      }
      addBugInfos([bug], function (err, bugs) {
        if (err) {
          bug.remove();
          return error(res, "Could not find bug");
        } else {
          return res.json(bugs);
        }
      });
    });
  });
};

exports.putBug = function(req, res) {
  if (!req.session.email) {
    return error(res, 'Not logged in.');
  }

  Project.findOne({_id: req.params.project_id}, function (err, project) {
    if (err) {
      return error(res, err, console);
    }

    if (!project) {
      return error(res, 'No project with id: ' + req.params.project_id);
    }

    //var mockup = project.mockups.id(req.params.mockup_id);
    if (project.user !== req.session.email) {
      return error(res, 'Cannot add a bug to a project you didn’t create!');
    }

    Bug.findById(req.params.bug_id, function (err, bug) {
      if (err) {
        return error(res, err, console);
      }

      if (!bug) {
        return error(res, 'No bug with id: ' + req.params.bug_id);
      }

      bug.number = req.body.number || bug.number;
      bug.startX = req.body.startX || bug.startX;
      bug.startY = req.body.startY || bug.startY;
      bug.endX = req.body.endX || bug.endX;
      bug.endY = req.body.endY || bug.endY;
      bug.mockup = req.params.mockup_id || bug.mockup;
      bug.save(function(err) {
        if (err) {
          return error(res, err, console);
        }
        return res.json(bug);
      });
    });
  });
};

exports.getBug = function (req, res) {
  return Bug.findById(req.params.bug_id, function (err, bug) {
    if (err) {
      return error(res, err, console);
    }
    addBugInfos([bug], function (err, bugs) {
      if (err) {
        return error(res, err, console);
      }

      return res.json(bugs[0]);
    });
  });
};

exports.deleteBug = function (req, res) {
  if (!req.session.email) {
    return error(res, 'Not logged in.');
  }
  Bug.findOne({_id: req.params.bug_id}, function (err, bug) {
    if (err) {
      return error(res, err, console);
    }

    if (!bug) {
      return error(res, 'No bug with id: ' + req.params.bug_id);
    }

    Project.findById(req.params.project_id, function (err, project) {
      if (err) {
        return error(res, err, console);
      }

      if (!project) {
        return error(res, 'No project with id: ' + req.params.project_id);
      }

      if (project.user !== req.session.email) {
        return error(res, 'Cannot delete a bug from a project you didn’t create!');
      }
      //var mockup = project.mockups.id(req.params.mockup_id);
      Bug.findOneAndRemove({_id: bug._id}, function (err, bug) {
        if (err) {
          return error(res, err, console);
        }
        return res.json(bug);
      });
    });
  });
};

exports.disabled = function(req, res) {
  res.send(501, 'Not implemented');
};

exports.dump = function (req, res) {
  Bug.find(function (err, bugs) {
    if (err) {
      return error(res, err, console);
    }
    Mockup.find(function (err, mockups) {
      if (err) {
        return error(res, err, console);
      }
      Project.find().sort('creationDate').exec(function (err, projects) {
        if (err) {
          return error(res, err, console);
        }
        var rv = [];
        projects.forEach(function (project) {
          var currentProject = {};
          currentProject.name = project.name;
          currentProject.creationDate = project.creationDate;
          currentProject.user = project.user;
          currentProject.mockups = [];
          mockups.filter(function (mockup) {
            return mockup.project === project._id;
          }).forEach(function (mockup) {
            var currentMockup = {};
            currentMockup.image = mockup.image;
            currentMockup.bugs = [];
            bugs.filter(function (bug) {
              return bug.mockup === mockup._id;
            }).forEach(function (bug) {
              var currentBug = {};
              currentBug.number = bug.number;
              currentBug.x = bug.x;
              currentBug.y = bug.y;
              currentMockup.bugs.push(currentBug);
            });
            currentProject.mockups.push(currentMockup);
          });
          rv.push(currentProject);
        });
        return res.json(rv);
      });
    });
  });
};

projectSchema.pre('validate', true, function slugifyProject(next, done) {
  next();
  if (this.slug !== undefined) {
    return done();
  }
  var slug = slugify(this.name);
  Project.find({slug: RegExp('^'+slug+'([-][0-9]+)?$')}, 'slug', function(err, projects) {
    // get an array of just the slugs
    var slugs = projects.map(function(project) {return project.slug;});
    if (slugs.indexOf(slug) === -1) {
      // the slug is unused, just use it
      this.slug = slug;
    } else {
      // the slug is used, append a hyphen and the first unused number starting from 2;
      var i = 2;
      while(slugs.indexOf(slug + '-' + i) !== -1) {
        i++;
      }
      this.slug = slug + '-' + i;
    }
    done();
  }.bind(this));
});

mockupSchema.pre('validate', function slugifyMockup(next) {
  if (this.slug !== undefined) {
    return next();
  }
  var slug = slugify(this.name);
  var project = this.parent();
  if (project.mockups.length === 1) {
    this.slug = slug;
    return next();
  }
  var slugs = project.mockups.map(function(mockup) {return mockup.slug;});
  if (slugs.indexOf(slug) === -1) {
    this.slug = slug;
  } else {
    var i = 2;
    while(slugs.indexOf(slug + '-' + i) !== -1) {
      i++;
    }
    this.slug = slug + '-' + i;
  }
  next();
});

function slugify(text) {
  return text
          .toLowerCase()
          .replace(/ +/g,'-')
          .replace(/[^\w-]+/g,'');
}

// Helper function to create any new products or themes if new
// This should use deferred
function saveUnsaved(list, Model, cb, acc) {
  // accumulator
  if (acc === undefined) {
    acc = [];
  }
  // base case
  if (list.length === 0) {
    // call callback with accumulated array of saved elements
    cb(acc);
  } else {
  // recursive case
    // Get an element check to see if it's new
    var elem = list.pop();
    if (elem._id === undefined) {
      // element is new, let's create and save it
      elem = new Model(elem);
      elem.save(function(err) {
        // If no errors (we're throwing out any erroneous elements)
        if (!err) {
          acc.push(elem);
          saveUnsaved(list, Model, cb, acc);
        } else {
          // error, throw out element and keep going
          saveUnsaved(list, Model, cb, acc);
        }
      });
    } else {
      // Element is not new push it onto acc and continue
      acc.push(elem);
      saveUnsaved(list, Model, cb, acc);
    }
  }
}
