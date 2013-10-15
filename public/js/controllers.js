/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true,
  strict:true, undef:true, browser:true, indent:2, maxerr:50, devel:true,
  boss:true, white:true, globalstrict:true, nomen:false, newcap:true*/

/*global _:false, foxographApp:false, run:false */

'use strict';

/* Controllers */

foxographApp.controller({

  // The ProjectsCtrl handles getting the list of projects, selecting a
  // project, and automatically selecting the appropriate mockup in that
  // project.
  'ProjectsCtrl': function ProjectsCtrl($scope, $location, $route, $routeParams, Restangular, $filter) {

    // Handle the change in route by setting the various ids.
    var routeChange = function routeChange() {
      console.log("$routeParams (project) = " + JSON.stringify($routeParams));
      $scope.p_id = $routeParams.p_id;
      $scope.m_id = $routeParams.m_id;
    };
    $scope.$on("$routeChangeSuccess", routeChange);


    // Handle a change in project id by setting the project.
    var changeProject = function changeProject() {
      if (!$scope.projects) {
        return;
      }
      if (!$scope.p_id) {
        $scope.p_id = $scope.projects[0]._id;
        return;
      }
      $scope.project = _.findWhere($scope.projects, {_id: $scope.p_id});
      $scope.selectedProject = $scope.project;
      $scope.onProjectSelect();
    };
    $scope.$watch('p_id', changeProject);


    // Handle a change in mockup id by setting the mockup.
    var changeMockup = function changeMockup() {
      if (!$scope.mockups) {
        return;
      }
      if (!$scope.m_id) {
        $scope.m_id = $scope.mockups[0]._id;
        return;
      }
      $scope.mockup = _.findWhere($scope.mockups, {_id: $scope.m_id});
      if (!$scope.mockup) {
        // Probably an old m_id from a previously-selected project.
        $scope.m_id = $scope.mockups[0]._id;
        return;
      }
      var mockupIndex = _.indexOf($scope.mockups, $scope.mockup);
      $scope.prevMockupId = (mockupIndex > 0) ?
                            $scope.mockups[mockupIndex - 1]._id : null;
      $scope.nextMockupId = (mockupIndex < $scope.mockups.length - 1) ?
                            $scope.mockups[mockupIndex + 1]._id : null;
      console.log("$scope.mockup = " + $scope.mockup);
    };
    $scope.$watch('m_id', changeMockup);


    // Load in the projects.
    $scope.loadProjects = function (p_id) {
      Restangular.all('projects').getList().then(function (projectList) {
        // Sort the projects by ['name','user'].
        $scope.projects = $filter('orderBy')(projectList, ['name', 'user']);
        if (p_id) {
          $scope.p_id = p_id;
        } else {
          changeProject();
        }
      });
    };
    $scope.loadProjects();


    // If we get a project, load in the mockups.
    $scope.$watch('project', function (project) {
      if (!project) {
        $scope.mockups = null;
        $scope.mockup = null;
        $scope.prevMockupId = null;
        $scope.nextMockupId = null;
        $scope.bugs = null;
        $scope.setBackground('');
        return;
      }
      project.getList('mockups').then(function (mockupList) {
        $scope.mockups = mockupList;
        changeMockup();
      });
    });

    // Event handlers!
    $scope.setBackground = function setBackground(background) {
      $scope.background = background;
    };

    $scope.onProjectSelect = function onProjectSelect() {
      var project = $scope.selectedProject;
      // If we have no project, that means they selected the "Create New Project" option!
      $location.path('/' + (project ? project._id : 'create'));
    };

  },

  'MockupCtrl': function MockupCtrl($scope, $route, $routeParams, Restangular, Image) {
    // Handle changes to the currently selected project.
    $scope.$watch('bugs', function (bugs) {
      setTimeout(function () {
        $scope.$apply(function () {
          console.log("Running!  1");
          run();
        });
      }, 15);
    }, true);
    $scope.$watch('project', function (project) {
      if (!project) {
        return;
      }
      project.getList('bugs').then(function (bugList) {
        $scope.bugs = bugList;
      });
    });

    var getMockupStyle = function (mockupImage, $scope) {
      var width = 'width: 100%; ';
      var height = 'height: 100%; ';
      var position = 'background-position: 45%; ';
      var imageUrl = '"/r/images/default.png"';
      if (mockupImage) {
        imageUrl = '"/r/images/bugzilla-loading.png"';
      }
      imageUrl = 'background-image: url(' + imageUrl + ');';

      $scope.mockupStyle = width + height + position + imageUrl;
      $scope.setBackground('');

      if (mockupImage) {
        Image.load(mockupImage, $scope).then(function (img) {
          width = 'width: ' + img.width + 'px;';
          height = 'height: ' + img.height + 'px;';
          position = '';
          imageUrl = 'background-image: url("' + mockupImage + '");';
          $scope.mockupStyle = width + height + position + imageUrl;

          var pixel = 'background-color: rgb(' + img.r + ',' + img.g + ',' + img.b + ');';
          $scope.setBackground(pixel);
        }, function (err) {
          console.log("Image errored!!!  " + err);
        });
      }
    };

    // Handle changes to the currently selected mockup.
    $scope.$watch('mockup', function (mockup) {
      if (!mockup) {
        return;
      }

      mockup.getList('bugs').then(function (bugList) {
        mockup.bugs = bugList;
        run();
      });
    });

    $scope.$watch('mockup.image', function (image) {
      console.log("Got mockup image of " + (image ? "something" : "nothing"));
      getMockupStyle(image, $scope);
    });

  },

  'NewMockupCtrl': function NewMockupCtrl($scope, $rootScope, $location, $route, Restangular) {
    $scope.project = {};
    $scope.create = function (newProject) {
      var projects = Restangular.all('projects');
      projects.post({name: newProject.name}).then(function (project) {
        project.post('mockups', {name: newProject.mockup}).then(function (mockup) {
          projects.getList().then(function (projectList) {
            $scope.$parent.loadProjects(project._id);
          });
        });
      });
    };
    $scope.reset = function () {
      $scope.project = {};
    };
  }

});
