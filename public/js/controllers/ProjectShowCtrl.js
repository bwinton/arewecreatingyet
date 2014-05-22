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
  'ProjectShowCtrl': function ProjectShowCtrl($scope, $rootScope, $location, $stateParams, Restangular, $filter) {
    console.log('BW - Setting project_id to ', $stateParams.project_id);
    
    $scope.form = {};

    $rootScope.$watch('projects', function() {
      $scope.project = _.findWhere($rootScope.projects, {_id: $stateParams.project_id});
      if ($scope.project) {
        $scope.form = Restangular.copy($scope.project);
        $scope.formChanged = false;
      }
    });

    function checkForm() {
      if ($scope.project)
      {
        if($scope.form.name !== $scope.project.name) return true;

        var projectThemes = _.map($scope.project.themes, function(theme) {return theme._id});
        var formThemes = _.map($scope.form.themes, function(theme) {return theme._id});

        var projectProducts = _.map($scope.project.products, function(product) {return product._id});
        var formProducts = _.map($scope.form.products, function(product) {return product._id});

        if (_.xor(projectThemes, formThemes).length !== 0 ||
            _.xor(projectProducts, formProducts).length !== 0) {
          return true;
        }
      }         
        return false;   
    }

    $scope.$watch('form', function() {
      $scope.formChanged = checkForm();
    }, true)

    $scope.updateProject = function() {
      var projectPromise = $scope.form.put()
      console.log($scope.form);
      projectPromise.then(function(project) {
        console.log(project);
        var projects = _.without($rootScope.projects, $scope.project)
        projects.push(project);
        $rootScope.projects = projects;
      })
    }

    $scope.deleteProject = function (project) {
      alert('deleting project ' + project.name);
      project.remove().then(function (data) {
        $scope.projects = _.without($scope.projects, project);
        $scope.project_id = null;
      });
    };

    $scope.deleteMockup = function (mockup) {
      var index = _.indexOf($rootScope.mockups, mockup);
      console.log("6 deleting " + mockup._id);
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

       // $rootScope.project_id = $stateParams.project_id;

    // Handle a change in project id by setting the project.
   /* $rootScope.$watch('project_id', function changeProject(project_id) {
      if (!$rootScope.projects) {
        // Hopefully we'll do this later.
        // We should totally make this into an Ensure clause on the route!!!
        return;
      }
      if (!$rootScope.project_id) {
        $scope.project = null;
        $scope.mockup = null;
        return;
      }
    }); */

    // If we have projects, and a project_id, make sure that we've set the project.

  }
});