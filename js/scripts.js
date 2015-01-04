var clientApp = angular.module('clientApp', ['ui.bootstrap', 'hljs', 'common', 'AuthInterceptor', 'Mediator']);


/**
 * Main application controller. Populates the form and submits the Service Request.
 *
 * TODO clean this up
 */
clientApp.controller('ClientAppCtrl', function($scope, clientAppHelper, utils, ProgressbarService, advancedSettings, SERVICES_CONFIG, ConfigService) {

	//Populate the form.
	$scope.service = advancedSettings;
	$scope.environments = SERVICES_CONFIG.environments;
	$scope.environmentSelected = SERVICES_CONFIG.environments[0].id;
	$scope.services = SERVICES_CONFIG.services;
	$scope.serviceSelected = SERVICES_CONFIG.services[0].id;

	//Submit the configured Service Request.
	$scope.submit = function() {
		//Remove any previous errors/alerts and hide the previous response.
		$scope.alerts = [];
		$scope.copyMessage = "";
		$scope.displayResponse = false;
		$scope.processing = true;

		//Update Progress Bar. TODO this is now pointless since we use an interceptor. any alternative?
		$scope.progress = ProgressbarService.getProgressState('START');

		//Pass the (user-configurable) settings needed by the Authentication Service to the Mediator.
		var authSettings = {
			'env' : $scope.environmentSelected,
			'ApplicationId': advancedSettings.appId,
			'x-dnb-user': advancedSettings.userId,
			'x-dnb-pwd': advancedSettings.password
		};
		ConfigService.setData(authSettings);

		//Determine the configured service endpoint.
		if (advancedSettings.requestUrl) {
			//If the user has entered a specific endpoint, just use that.
			$scope.requestUrl = advancedSettings.requestUrl;
		} else {
			$scope.requestUrl = clientAppHelper.configureServiceUrl($scope.environmentSelected, $scope.serviceSelected, $scope.duns);
		}

		//Call the endpoint.
		$scope.progress = ProgressbarService.getProgressState('IN_PROGRESS');
		clientAppHelper.callService($scope);
	}

	//Remove the selected alert/error.
	$scope.closeAlert = function(index) {
		$scope.alerts.splice(index, 1);
	};

	//Copy the request or response to the clipboard.
	$scope.copy = function(text) {
		$scope.copyMessage = "Successfully copied to the Clipboard.";
		utils.copyToClipboard(text);
	};
});


/**
 * Simple controller for toggling a value.
 */
clientApp.controller('ToggleCtrl', function($scope) {
	$scope.toggle = function(status) {
		$scope.status = !status;
	}
});


/**
 * Various helper functions for the application. TODO move this to it's own js file for easy testing. What naming convention is used?
 */
clientApp.service('clientAppHelper', function($http, $location, $anchorScroll, utils, ProgressbarService, advancedSettings, SERVICES_CONFIG) {
	var helper = this;

	/**
	 * Based on the selected environment and service, determine the correct URL to use.
	 */
	helper.configureServiceUrl = function(environmentSelected, serviceSelected, dunsSelected) {
		var url = "";
		var duns = SERVICES_CONFIG.placeholderDuns;

		//Determine the endpoint based on selected Environment and Service.
		for (var i in SERVICES_CONFIG.endpoints) {
			var endpoint = SERVICES_CONFIG.endpoints[i];
			if (endpoint.env === environmentSelected && endpoint.service === serviceSelected) {
				url = endpoint.url;
				break;
			}
		}

		//Replace the DUNS placeholder.
		if (dunsSelected) {
			duns = utils.replaceAll(dunsSelected, "-", "");
		}
		if (url) {
			url = url.replace("{duns}", duns);
		}
		return url;
	};

	/**
	 * Call the specified endpoint and update the UI.
	 */
	helper.callService = function($scope) {
		var requestConfig = { headers: {
			'ApplicationId': advancedSettings.appId
		}};
		requestConfig.authenticate = true;

		//Determine if this should be a GET or POST request.
		var promise;
		if (advancedSettings.payload) {
			requestConfig.headers['Accept'] = "application/json";
			requestConfig.headers['Content-Type'] = "application/json";
			promise = $http.post($scope.requestUrl, advancedSettings.payload, requestConfig);
		} else {
			promise = $http.get($scope.requestUrl, requestConfig);
		}

		promise.then(function(success) {
			helper.populateView($scope, success);
			helper.displayView($scope);
		}, function(error) {
			helper.populateView($scope, error);
			helper.displayView($scope);
		});
	};

	/**
	 * Update the UI with the data received from the service.
	 *
	 * TODO need to revisit this entire function.
	 */
	helper.populateView = function($scope, response) {
		$scope.progress = ProgressbarService.getProgressState('COMPLETE');

		if (response.data) {
			$scope.responseBody = JSON.stringify(response.data, null, 2);
			response.headers().status = response.status;
			$scope.responseHeaders = JSON.stringify(response.headers(), null, 2);
			$scope.requestHeaders = JSON.stringify(response.config, null, 2);
			//$scope.authenticationToken = response.config.headers.Authorization;
		} else {
			//An error occurred.
			$scope.alerts.push({type: 'danger', msg: 'An error occurred.'});
			$scope.responseBody = response.message;
			$scope.responseHeaders = "";
			$scope.requestHeaders = JSON.stringify(response, null, 2);
		}
	};

	/**
	 * Show the view and automatically scroll down to it.
	 */
	helper.displayView = function($scope) {
		$scope.displayResponse = true;
		$scope.processing = false;

		//Attempt to scroll to the response. This has issues.
		var old = $location.hash();
		$location.hash('response');
		$anchorScroll();
		$location.hash(old);
	};
});


/**
 * Service for managing the progress bar.
 */
clientApp.service('ProgressbarService', function() {
	var PROGRESS_STATES = {
		START: { value: 10, label: 'Authenticating... ' },
		IN_PROGRESS: { value: 50, label: 'Making Service Request... ' },
		COMPLETE: { value: 100, label: 'Response Received' }
	};

	/**
	 * Return details about the specified state (percentage and a status label).
	 */
	this.getProgressState = function(progress) {
		return PROGRESS_STATES[progress];
	};
});

