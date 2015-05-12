//= require jquery-ui/accordion
//= require_tree .


$(function () {
    $("#accordion > div").accordion({header: "h3", collapsible: true, active: false});
});


var app = angular.module('app', ['ngTouch', 'ui.grid', 'ui.grid.exporter', 'ui.grid.autoResize', 'ui.grid.grouping', 'ui.grid.resizeColumns', 'ui.grid.moveColumns']);

app.controller('MainCtrl', ['$scope', '$http', '$interval', '$q', 'uiGridGroupingConstants', function ($scope, $http, $interval, $q, uiGridGroupingConstants) {


    columnDefs = [];

    columnDefs = [
        {field: 'Job ID', width: '6%', grouping: {groupPriority: 0}},
        {field: 'Stage ID', width: '7%', grouping: {groupPriority: 1}},
        {field: 'Task ID', width: '7%'},
        {field: 'Stage Name', width: '17%'},
        {field: 'Result', width: '10%'},
        {field: 'Task Duration', width: '10%', grouping: {aggregation: uiGridGroupingConstants.aggregation.MAX}},
        {field: 'Job Duration', width: '10%', grouping: {aggregation: uiGridGroupingConstants.aggregation.AVG}},
        {field: 'Task Type', width: '10%'},
        {field: 'Reason', width: '11%'},
        {
            field: 'JVM GC Time',
            name: 'GC Time',
            width: '8%',
            grouping: {aggregation: uiGridGroupingConstants.aggregation.MAX}
        },
    ];

    n = columnDefs.length;


    for (var k in all_keys) {
        alreadyExist = false;
        for (var i = 0; i < n; i++) {
            if (columnDefs[i]['field'] === all_keys[k]) {
                alreadyExist = true;
                break;
            }
        }
        if (!alreadyExist)
            columnDefs.push({field: all_keys[k], width: '10%', visible: false})
    }

    $scope.gridOptions = {
        exporterMenuCsv: true,
        exporterMenuPdf: false,
        enableGridMenu: true,
        columnDefs: columnDefs,
        onRegisterApi: function (gridApi) {
            $scope.gridApi = gridApi;
        }
    };

    $scope.gridOptions.data = spark_log;


    $scope.saveState = function () {
        $scope.state = $scope.gridApi.saveState.save();
    };

    $scope.restoreState = function () {
        $scope.gridApi.saveState.restore($scope, $scope.state);
    };

}]);
