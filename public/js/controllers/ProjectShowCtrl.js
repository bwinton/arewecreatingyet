/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true,
  strict:true, undef:true, browser:true, indent:2, maxerr:50, devel:true,
  boss:true, white:true, globalstrict:true, nomen:false, newcap:true*/

/*global _:false, foxographApp:false */

'use strict';

/* Controllers */

foxographApp.controller({

  // The ProjectsCtrl handles getting the list of projects, selecting a
  // project, and automatically selecting the appropriate mockup in that
  // project.
  'ProjectShowCtrl': function ProjectShowCtrl($scope, $rootScope, $location, $state, $stateParams, Restangular, $filter) {

    $scope.form = {};
    $scope.loaded = false;
    $scope.editing = false;

    var mockups = {};
    $scope.total= {resolved: 0, assigned: 0, unassigned: 0};

    $scope.$watch('projects', function() {
      $scope.project = _.findWhere($rootScope.projects, {slug: $stateParams.project_slug});
      $scope.total= {resolved: 0, assigned: 0, unassigned: 0};
      if ($scope.project) {
        $rootScope.title = $scope.project.name;
        $scope.form = Restangular.copy($scope.project);
        $scope.formChanged = false;
        $scope.archivedMockups = [];

        _.forEach($scope.project.mockups, function(mockup) {
          if (mockup.archived) {
            $scope.archivedMockups.push(mockup);
            return;
          }
          mockups[mockup._id] = {resolved: 0, assigned: 0, unassigned: 0};
          _.forEach(mockup.bugs, function(bug) {
              var status = bugIs(bug);
              mockups[mockup._id][status] += 1;
              $scope.total[status] += 1;
          });
        });
      }
      $scope.loaded = true;
    }, true);

    function checkForm() {
      if (!$scope.project) {
        return false;
      }
      if ($scope.form.name !== $scope.project.name) return true;

      if ($scope.form.archived !== $scope.project.archived) return true;

      var projectThemes = _.map($scope.project.themes, function(theme) {return theme._id;});
      var formThemes = _.map($scope.form.themes, function(theme) {return theme._id;});

      var projectProducts = _.map($scope.project.products, function(product) {return product._id;});
      var formProducts = _.map($scope.form.products, function(product) {return product._id;});

      if (_.xor(projectThemes, formThemes).length !== 0 ||
          _.xor(projectProducts, formProducts).length !== 0) {
        return true;
      }
      return false;
    }

    $scope.$watch('form', function() {
      $scope.formChanged = checkForm();
    }, true);

    $scope.addMockup = function() {
      var mockup = {};
      mockup.name = $scope.mockupForm.name;
      if (mockup.name) {
        Restangular.restangularizeElement($scope.project, mockup, 'mockups');
        mockup.post().then(function(mockup) {
          mockup.bugs = [];
          $scope.mockupForm.name = '';
          $scope.project.mockups.push(mockup);
        });
      }
    };

    $scope.updateProject = function() {
      var projectPromise = $scope.form.put();
      projectPromise.then(function(project) {
        var projects = _.without($rootScope.projects, $scope.project);
        projects.push(project);
        $rootScope.projects = projects;

        // add newly created products to rootscope
        var newProducts = _.where(project.products, function(product) {
          return ! _.some($rootScope.products, {_id: product._id});
        });

        // delete any newly created products that were unsaved
        $rootScope.products = _.filter($rootScope.products.concat(newProducts), "_id");


        // add newly created themes to rootscope
        var newThemes = _.where(project.themes, function(theme) {
          return ! _.some($rootScope.themes, {_id: theme._id});
        });

        // delete any newly created themes that were unsaved
        $rootScope.themes = _.filter($rootScope.themes.concat(newThemes), "_id");

        $state.go('app.project.show', {'project_slug': project.slug});
      });
    };

    $scope.$on('$destroy', function() {
      $rootScope.themes = _.filter($rootScope.themes, "_id");
      $rootScope.products = _.filter($rootScope.products, "_id");
    });

    $scope.resolved = function(mockup) {
      if (mockup.bugs) {
        return mockups[mockup._id].resolved;
      }
      return '-';
    };

    $scope.assigned = function(mockup) {
      if (mockup.bugs) {
        return mockups[mockup._id].assigned;
      }
      return '-';
    };

    $scope.unassigned = function(mockup) {
      if (mockup.bugs) {
        return mockups[mockup._id].unassigned;
      }
      return '-';
    };

    $scope.edit = function() {
      $scope.editing = true;
    };

    $scope.done = function() {
      $scope.editing = false;
    };

    $scope.deleteProject = function (project) {
      project.remove().then(function (data) {
        $scope.projects = _.without($scope.projects, project);
        $scope.project_id = null;
      });
    };

    $scope.deleteMockup = function (mockup) {
      var index = _.indexOf($rootScope.mockups, mockup);
      mockup.remove().then(function (data) {
        $rootScope.mockups = _.without($rootScope.mockups, mockup);
        if (index >= $rootScope.mockups.length) {
          index = $rootScope.mockups.length - 1;
        }
        if (index < 0) {
          index = 0;
        }
        var nextMockup = null;
        if ($rootScope.mockups.length > 0) {
          nextMockup = $rootScope.mockups[index];
        }
      });
    };

    $scope.archive = function(mockup) {
      mockup.archived = true;
      Restangular.restangularizeElement($scope.project, mockup, 'mockups');
      mockup.put();
    };

    $scope.unarchive = function(mockup) {
      mockup.archived = false;
      Restangular.restangularizeElement($scope.project, mockup, 'mockups');
      mockup.put();
    };

    $scope.saveMockup = function(mockup, name) {
      mockup.name = name;
      Restangular.restangularizeElement($scope.project, mockup, 'mockups');
      mockup.put();
    };

    $scope.resetProject = function() {
      $scope.form = Restangular.copy($scope.project);
      $scope.formChanged = false;
    };

    function bugIs(bug) {
      if (bug.status === 'RESOLVED' || bug.status === 'VERIFIED') {
        return 'resolved';
      }

      if (bug.assigned !== 'Nobody; OK to take it and work on it') {
        return 'assigned';
      }

      return 'unassigned';
    }
  }
});
