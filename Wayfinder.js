/*jslint devel: true, browser: true, windows: true, plusplus: true, maxerr: 50, indent: 4 */

/**
 * @preserve
 * Wayfinding v0.2.0
 * https://github.com/ucdavis/wayfinding
 *
 * Copyright (c) 2010 University of California Regents
 * Licensed under GNU General Public License v2
 * http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 *
 * Date: 2010-08-02, 2014-02-03
 *
 */

//  <![CDATA[

/** MODIFIED BY TODARO C. **/
/** Variabili usate per distinguere il click dal double click **/
var DELAY = 500,
    clicks = 0,
    timer = null;

(function ($) {

    'use strict';

    /*
    $.getScript("scripts/customevents.js", function(){

       alert("Script loaded and executed.");
       // Here you can use anything you defined in the loaded script
    });
    */

    var defaults = {
        // попытка найти svg файл с именем floorplan
        'maps': [{'path': 'floorplan.svg', 'id': 'map.1'}],

        'path': {
            color: 'red',
            radius: 10,
            speed: 8,
            width: 3
        },
        // ID двери для начальной точкеи
        'startpoint': function () {
            return 'startpoint';
        },

        'endpoint': false,

        'accessibleRoute': false,

        'defaultMap': function () {
            return 'map.1';
        },
        'dataStoreCache' : false,
        'showLocation' : false,
        'locationIndicator' : {
            fill: 'red',
            height: 40
        },
        'wayFound' : false,
        'zoomToRoute' : false,
        'zoomPadding' : 50,
        'mapEvents': false
    };

    $.fn.wayfinding = function (action, options) {

        var passed = options,
            dataStore = {
                'paths': [],
                'portals': []
            },
            obj, //  jQuery объект, с которым ведется работа;
            maps, // массив карт, каждый раз заполняемый из опций
            defaultMap, // этаж, который будет отображаться при запуске, задан из опций
            startpoint, // результат/значения options.startpoint, либо значения функции
            portalSegments = [], // используется для хранения частей портала до тех пор, пока порталы не будут собраны, а затем выбрасывается.
            drawing,
            solution,
            result; // используется для возврата результатов, отличных от jQuery

        // установить параметры на основе предоставленных параметров, предыдущих настроек или значений по умолчанию
        function getOptions(el) {

            var optionsPrior = el.data('wayfinding:options'), // попытка загрузить предыдущие настройки
                dataStorePrior = el.data('wayfinding:data'); // загрузить любые сохраненные данные

            drawing = el.data('wayfinding:drawing'); // загрузить нарисованный путь, если он существует

            if (optionsPrior !== undefined) {
                options = optionsPrior;
            } else {
                options = $.extend(true, {}, defaults, options);
            }

            // проверить настройки, прикрепленные к текущему объекту
            options = $.metadata ? $.extend(true, {}, options, el.metadata()) : options;

            // Создание ссылки на параметры
            maps = options.maps;

            // корректное задание начального этажа
            if (typeof (options.defaultMap) === 'function') {
                defaultMap = options.defaultMap();
            } else {
                defaultMap = options.defaultMap;
            }

            // корректное задание начальной точки
            if (typeof (options.startpoint) === 'function') {
                setStartPoint(options.startpoint(), el);
            } else {
                startpoint = options.startpoint;
            }

            if (dataStorePrior !== undefined) {
                dataStore = dataStorePrior;
            }
        }


        function setOptions(el) {
            el.data('wayfinding:options', options);
            el.data('wayfinding:drawing', drawing);
            el.data('wayfinding:data', dataStore);
        }

        //проверка на то, что все ID уникальные

        function checkIds() {
            var mapNum,
                checkNum,
                reassign = false,
                defaultMapValid = false;

            if (maps.length > 0) {
                for (mapNum = 0; mapNum < maps.length; mapNum++) {
                    for (checkNum = mapNum; checkNum < maps.length; checkNum++) {
                        if (mapNum !== checkNum && maps[mapNum].id === maps[checkNum].id) {
                            reassign = true;
                        }
                    }
                }

                if (reassign === true) {
                    for (mapNum = 0; mapNum < maps.length; mapNum++) {
                        maps[mapNum].id = 'map_' + mapNum;
                    }
                }
                //проверка на то, что начальный этаж доступен и корректен

                for (mapNum = 0; mapNum < maps.length; mapNum++) {
                    if (maps[mapNum].id === defaultMap) {
                        defaultMapValid = true;
                    }
                }

                if (defaultMapValid === false) {
                    defaultMap = maps[0].id;
                }
            } /* else {
				// raise exception about no maps being found
			} */
        } //function checkIds

        //Takes x and y coordinates and makes a location indicating pin for those
        //coordinates. Returns the pin element, not yet attached to the DOM.
        function makePin(x, y) {
            var indicator,
                height,
                width,
                symbolPath;

            indicator = document.createElementNS('http://www.w3.org/2000/svg', 'path');

            $(indicator).attr('class', 'locationIndicator');

            height = options.locationIndicator.height;
            width = height * 5 / 8;

            //draws map pin
            symbolPath = 'M ' + x + ' ' + y;
            //1st diagonal line
            symbolPath += ' l ' + width / 2 + ' ' + height * (-2) / 3;
            //curve over top
            //rx, ry
            symbolPath += ' a ' + width / 2 + ' ' + height / 3;
            //x-axis-rotation large-arc-flag sweep-flag
            symbolPath += ' 0 0 0 ';
            //dx, dy
            symbolPath += width * (-1) + ' 0 ';
            //close path
            symbolPath += 'Z';
            //finish with circle at center of pin
            symbolPath += ' m ' + height / (-8) + ' ' + height * (-2) / 3;
            symbolPath += ' a ' + height / 8 + ' ' + height / 8;
            symbolPath += ' 0 1 0 ';
            symbolPath += height / 4 + ' 0';
            symbolPath += ' a ' + height / 8 + ' ' + height / 8;
            symbolPath += ' 0 1 0 ';
            //drawing circle, right back where we started.
            symbolPath += height / (-4) + ' 0';

            indicator.setAttribute('d', symbolPath);
            indicator.setAttribute('fill', options.locationIndicator.fill);
            indicator.setAttribute('fill-rule', 'evenodd');
            indicator.setAttribute('stroke', 'black');

            return indicator;
        } //function makePin

        //set the start point, and put a location indicator
        //in that spot, if feature is enabled.
        function setStartPoint(passed, el) {
            var start,
                x, y,
                pin;

            //clears locationIndicators from the maps
            $('path.locationIndicator', el).remove();

            // set startpoint correctly
            if (typeof (passed) === 'function') {
                options.startpoint = passed();
            } else {
                options.startpoint = passed;
            }

            startpoint = options.startpoint;

            if (options.showLocation) {
                start = $('#Doors #' + startpoint, el);

                if (start.length) {
                    x = (Number(start.attr('x1')) + Number(start.attr('x2'))) / 2;
                    y = (Number(start.attr('y1')) + Number(start.attr('y2'))) / 2;

                    pin = makePin(x, y);

                    start.after(pin);
                } else {
                    return; //startpoint does not exist
                }
            }
        } //function setStartPoint

        function cleanupSVG(target, el) {
            //скрывать карты до тех пор, пока они не будут отображены явно
            $(el).hide();

            //скрыть информацию о маршруте
            $('#Paths line', el).attr('stroke-opacity', 0);
            $('#Doors line', el).attr('stroke-opacity', 0);
            $('#Portals line', el).attr('stroke-opacity', 0);

            //Rooms


            $('#Rooms a, #Doors line', el).each(function () {
                if ($(this).prop('id') && $(this).prop('id').indexOf('_') > 0) {
                    var oldID = $(this).prop('id');
                    $(this).prop('id', oldID.slice(0, oldID.indexOf('_')));
                }
            });

            //The following need to use the el variable to scope their calls: el is jquery element

            // make clickable
            // removed el scope from this next call.

            /** MODIFIED BY TODARO C. **/
            /** Di default ad un evento di "doppio click" corrispondono due eventi di click e ciò causa l'evento di zoom e contemporaneamente
             un ricalcolo della route verso la stanza corrispondente al punto cliccato. La modifica seguente permette invece che al singolo click
             venga chiamata la funzione di wayfinding e col doppio click quella di zoom. **/
            /*
            $('#Rooms a', el).click(function (event) {
                $(target).wayfinding('routeTo', $(this).prop('id'));
                alert('target: ' + target + ' e id: ' + $(this).prop('id'));
                event.preventDefault();
            });
            */
            // делает комнату пунктом назначения кликом ЛКМ по ней
            $('#Rooms a', el).bind({
                click: function(e) {
                    if(timer===null){

                        timer = setTimeout(function() {
                            if(clicks === 1){
                                //alert("Singolo click");
                                $(target).wayfinding('routeTo', e.currentTarget.id);
                                e.preventDefault();
                            }
                            clicks = 0;
                            timer=null;
                        }, DELAY);
                    }

                    clicks++;

                    if(clicks === 2){
                        //alert("Doppio click");
                        clearTimeout(timer);
                        clicks = 0;
                        timer=null;
                    }
                },
                dblclick: function(e) {
                    e.preventDefault(); //don't do anything
                }
            });
        } //function cleanupSVG

        // Извлечение данных из карт SVG
        function finishFloor(el, mapNum, floor) {

            var path,
                doorId,
                x1,
                y1,
                x2,
                y2,
                matches,
                portal,
                portalId;

            //Paths

            dataStore.paths[mapNum] = [];

            $('#' + floor.id + ' #Paths line', el).each(function () { // index, line

                path = {};
                path.floor = floor.id; // floor_1
                path.mapNum = mapNum; // index of floor in array 1
                path.route = Infinity; //Distance
                path.prior = -1; //Prior node in path that yielded route distance
                path.ax = $(this).prop('x1').animVal.value;
                path.ay = $(this).prop('y1').animVal.value;
                path.doorA = [];
                path.bx = $(this).prop('x2').animVal.value;
                path.by = $(this).prop('y2').animVal.value;
                path.doorB = [];
                path.length = Math.sqrt(Math.pow(path.ax - path.bx, 2) + Math.pow(path.ay - path.by, 2));

                path.connections = []; //other paths
                path.portals = []; // connected portals

                dataStore.paths[mapNum].push(path);

            });

            //двери и начальные точки


            $('#' + floor.id + ' #Doors line', el).each(function () { // index, line

                x1 = $(this).prop('x1').animVal.value;
                y1 = $(this).prop('y1').animVal.value;
                x2 = $(this).prop('x2').animVal.value;
                y2 = $(this).prop('y2').animVal.value;
                doorId = $(this).prop('id');

                $.each(dataStore.paths[mapNum], function (index, path) {
                    if (floor.id === path.floor && ((path.ax === x1 && path.ay === y1) || (path.ax === x2 && path.ay === y2))) {
                        path.doorA.push(doorId);
                    } else if (floor.id === path.floor && ((path.bx === x1 && path.by === y1) || (path.bx === x2 && path.by === y2))) {
                        path.doorB.push(doorId);
                    }
                });

            });

            //лестницы

            $('#' + floor.id + ' #Portals line', el).each(function () { // index, line
                portal = {};

                portalId = $(this).prop('id');

                if (portalId && portalId.indexOf('_') > -1) {
                    portalId = portalId.slice(0, portalId.indexOf('_'));
                }

                portal.id = portalId;
                portal.type = portalId.split('.')[0];
                portal.floor = floor.id;

                portal.mate = portalId.split('.').slice(0, 2).join('.') + '.' + floor.id;

                portal.mapNum = mapNum;

                portal.matched = false;

                x1 = $(this).prop('x1').animVal.value;
                y1 = $(this).prop('y1').animVal.value;
                x2 = $(this).prop('x2').animVal.value;
                y2 = $(this).prop('y2').animVal.value;

                matches = $.grep(dataStore.paths[mapNum], function (n) { // , i
                    return ((x1 === n.ax && y1 === n.ay) || (x1 === n.bx && y1 === n.by));
                });

                if (matches.length !== 0) {
                    portal.x = x1;
                    portal.y = y1;
                } else {
                    portal.x = x2;
                    portal.y = y2;
                }

                //portal needs length -- long stairs versus elevator
                portal.length = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));

                portalSegments.push(portal);

            });
        } // function finishfloor


        // после извлечения данных из всех svg-карт построение между ними соединений
        function buildPortals() {

            var segmentOuterNum,
                segmentInnerNum,
                outerSegment,
                innerSegment,
                portal,
                mapNum,
                pathOuterNum,
                pathInnerNum,
                portalNum,
                pathNum;

            for (segmentOuterNum = 0; segmentOuterNum < portalSegments.length; segmentOuterNum++) {

                outerSegment = portalSegments[segmentOuterNum];

                if (outerSegment.matched === false) {

                    for (segmentInnerNum = segmentOuterNum; segmentInnerNum < portalSegments.length; segmentInnerNum++) {
                        if (portalSegments[segmentInnerNum].id === outerSegment.mate && portalSegments[segmentInnerNum].mate === outerSegment.id) {
                            innerSegment = portalSegments[segmentInnerNum];

                            portal = {};

                            outerSegment.matched = true;
                            innerSegment.matched = true;

                            portal.type = outerSegment.type;
                            portal.accessible = (portal.type === 'Elev' || portal.type === 'Door') ? true : false;

                            portal.idA = outerSegment.id;
                            portal.floorA = outerSegment.floor;
                            portal.floorANum = outerSegment.mapNum;
                            portal.xA = outerSegment.x;
                            portal.yA = outerSegment.y;
                            portal.connectionsA = [];

                            portal.idB = innerSegment.id;
                            portal.floorB = innerSegment.floor;
                            portal.floorBNum = innerSegment.mapNum;
                            portal.xB = innerSegment.x;
                            portal.yB = innerSegment.y;
                            portal.connectionsB = []; // only paths

                            portal.length = outerSegment.length + innerSegment.length;

                            portal.route = Infinity;
                            portal.prior = -1;

                            dataStore.portals.push(portal);

                        }
                    }
                }
            }

            //провяем каждый путь на наличие соединений с другими путями
            //проверяем только возможные совпадения на одном этаже
            for (mapNum = 0; mapNum < maps.length; mapNum++) {
                for (pathOuterNum = 0; pathOuterNum < dataStore.paths[mapNum].length - 1; pathOuterNum++) {
                    for (pathInnerNum = pathOuterNum + 1; pathInnerNum < dataStore.paths[mapNum].length; pathInnerNum++) {
                        if (
                            (dataStore.paths[mapNum][pathInnerNum].ax === dataStore.paths[mapNum][pathOuterNum].ax &&
                                dataStore.paths[mapNum][pathInnerNum].ay === dataStore.paths[mapNum][pathOuterNum].ay) ||
                            (dataStore.paths[mapNum][pathInnerNum].bx === dataStore.paths[mapNum][pathOuterNum].ax &&
                                dataStore.paths[mapNum][pathInnerNum].by === dataStore.paths[mapNum][pathOuterNum].ay) ||
                            (dataStore.paths[mapNum][pathInnerNum].ax === dataStore.paths[mapNum][pathOuterNum].bx &&
                                dataStore.paths[mapNum][pathInnerNum].ay === dataStore.paths[mapNum][pathOuterNum].by) ||
                            (dataStore.paths[mapNum][pathInnerNum].bx === dataStore.paths[mapNum][pathOuterNum].bx &&
                                dataStore.paths[mapNum][pathInnerNum].by === dataStore.paths[mapNum][pathOuterNum].by)
                        ) {
                            dataStore.paths[mapNum][pathOuterNum].connections.push(pathInnerNum);
                            dataStore.paths[mapNum][pathInnerNum].connections.push(pathOuterNum);
                        }
                    }
                }
            }

            //optimize portal searching of paths
            for (portalNum = 0; portalNum < dataStore.portals.length; portalNum++) {
                for (mapNum = 0; mapNum < maps.length; mapNum++) {
                    for (pathNum = 0; pathNum < dataStore.paths[mapNum].length; pathNum++) {
                        if (dataStore.portals[portalNum].floorA === dataStore.paths[mapNum][pathNum].floor &&
                            ((dataStore.portals[portalNum].xA === dataStore.paths[mapNum][pathNum].ax &&
                                    dataStore.portals[portalNum].yA === dataStore.paths[mapNum][pathNum].ay) ||
                                (dataStore.portals[portalNum].xA === dataStore.paths[mapNum][pathNum].bx &&
                                    dataStore.portals[portalNum].yA === dataStore.paths[mapNum][pathNum].by))) {
                            dataStore.portals[portalNum].connectionsA.push(pathNum);
                            dataStore.paths[mapNum][pathNum].portals.push(portalNum);
                        } else if (dataStore.portals[portalNum].floorB === dataStore.paths[mapNum][pathNum].floor &&
                            ((dataStore.portals[portalNum].xB === dataStore.paths[mapNum][pathNum].ax &&
                                    dataStore.portals[portalNum].yB === dataStore.paths[mapNum][pathNum].ay) ||
                                (dataStore.portals[portalNum].xB === dataStore.paths[mapNum][pathNum].bx &&
                                    dataStore.portals[portalNum].yB === dataStore.paths[mapNum][pathNum].by))) {
                            dataStore.portals[portalNum].connectionsB.push(pathNum);
                            dataStore.paths[mapNum][pathNum].portals.push(portalNum);
                        }
                    }
                }
            }

            portalSegments = [];

        }   // end function buildportals

        function replaceLoadScreen(el) {
            var displayNum,
                mapNum;

            $('#mapLoading').remove();

            //loop ensures defaultMap is in fact one of the maps
            displayNum = 0;
            for (mapNum = 0; mapNum < maps.length; mapNum++) {
                if (defaultMap === maps[mapNum].id) {
                    displayNum = mapNum;
                }
            }

            //hilight starting floor
            $('#' + maps[displayNum].id, el).show(0, function() {
                $(this).trigger('wfMapsVisible');
            }); // rework
            //if endpoint was specified, route to there.
            if (typeof(options.endpoint) === 'function') {
                routeTo(options.endpoint());
            } else if (typeof(options.endpoint) === 'string') {
                routeTo(options.endpoint);
            }
        } //function replaceLoadScreen

        //deletes path metadata from datastore.
        //otherwise old path data will be reused.
        function prepareForSearch() {
            var mapNum,
                pathNum,
                portalNum;

            // set route distance back to infinity and prior path to unvisited
            for (mapNum = 0; mapNum < maps.length; mapNum++) {
                for (pathNum = 0; pathNum < dataStore.paths[mapNum].length; pathNum++) {
                    dataStore.paths[mapNum][pathNum].route = Infinity;
                    dataStore.paths[mapNum][pathNum].prior = -1;
                }
            } //function prepareForSearch

            // reset portals
            for (portalNum = 0; portalNum < dataStore.portals.length; portalNum++) {
                //Set route distance to infinity
                dataStore.portals[portalNum].route = Infinity;
                //indicate which node was used to get to this node -1 = none
                dataStore.portals[portalNum].prior = -1;
                dataStore.portals[portalNum].priormapNum = -1;
            }
        }

        function loadMaps(target) {
            var processed = 0;

            $.each(maps, function (i, floor) {
                //создаем div для размещения карты, отключенной от DOM по соображениям производительности
                var targetFloor = $('<div id="' + floor.id + '"><\/div>');

                //создаем SVG в этом div
                targetFloor.load(
                    floor.path,
                    function (svg) {

                        processed = processed + 1;
                        maps[i].svgHandle = svg;
                        cleanupSVG(target, targetFloor);

                        //прикрепляем div
                        target.append(this);

                        if (!options.dataStoreCache) {
                            finishFloor(target, i, floor);

                            if (processed === maps.length) {
                                buildPortals();
                            }
                        }

                        if (processed === maps.length) {
                            setStartPoint(options.startpoint, target);
                            setOptions(target);
                            replaceLoadScreen(target);
                        }
                    }
                );
            });
        } // function loadMaps

        //initialize the jQuery target object
        function initialize(target) {
            //Pull dataStore from cache, if available.
            if (options.dataStoreCache) {
                if (typeof(options.dataStoreCache) === 'object') {
                    dataStore = options.dataStoreCache;
                    loadMaps(target);
                } else if (typeof(options.dataStoreCache) === 'string') {
                    $.getJSON(options.dataStoreCache, function (result) {
                        dataStore = result;
                        loadMaps(target);
                    }).fail(function () {
                        console.log('Failed to get dataStore cache. Falling back to client-side dataStore generation.');

                        dataStore.paths = [];
                        dataStore.portals = [];
                        options.dataStoreCache = false;

                        loadMaps(target);
                    });
                }
            } else {
                dataStore.paths = [];
                dataStore.portals = [];

                loadMaps(target);
            }
        } // function initialize
        //Функция для смены этажа
        function switchFloor(floor, el) {
            $('div', el).hide();
            $('#' + floor, el).show(0, function() {
                if (options.mapEvents) {
                    $(el).trigger('wfFloorChange');
                }
            });

            var i, level, mapNum, pathLength;

            if (drawing) {
                mapNum = -1;
                for (i = 0; i < maps.length; i++) {
                    if (maps[i] === floor) {
                        mapNum = i;
                    }
                }
                level = -1;
                for (i = 0; i < drawing.length; i++) {
                    if (drawing[i].floor === mapNum) {
                        level = i;
                    }
                }

                if (level !== -1) {
                    pathLength =  drawing[level].routeLength;
                    $(drawing[level].path, el).attr('stroke-dasharray', [pathLength, pathLength]);
                    $(drawing[level].path, el).attr('stroke-dashoffset', pathLength);
                    $(drawing[level].path, el).attr('pathLength', pathLength);
                    $(drawing[level].path, el).attr('stroke-dashoffset', pathLength);
                    $(drawing[level].path, el).animate({svgStrokeDashOffset: 0}, pathLength * options.path.speed);
                }
            }
        } //function switchFloor

        function recursiveSearch(segmentType, segmentFloor, segment, length) {
            //SegmentType is PAth or POrtal, segment floor limits search, segment is id per type and floor, length is total length of current thread
            // for each path on this floor look at all the paths we know connect to it
            $.each(dataStore.paths[segmentFloor][segment].connections, function (i, tryPath) {
                // check and see if the current path is a shorter path to the new path
                if (length + dataStore.paths[segmentFloor][tryPath].length < dataStore.paths[segmentFloor][tryPath].route) {
                    dataStore.paths[segmentFloor][tryPath].route = length + dataStore.paths[segmentFloor][tryPath].length;
                    dataStore.paths[segmentFloor][tryPath].prior = segment;
                    dataStore.paths[segmentFloor][tryPath].priorType = segmentType;
                    recursiveSearch('pa', segmentFloor,  tryPath, dataStore.paths[segmentFloor][tryPath].route);
                }
            });
            // if the current path is connected to any portals
            if (dataStore.paths[segmentFloor][segment].portals.length > 0) {
                // look at each portal, tryPortal is portal index in portals
                $.each(dataStore.paths[segmentFloor][segment].portals, function (i, tryPortal) {
                    if (length + dataStore.portals[tryPortal].length < dataStore.portals[tryPortal].route && (options.accessibleRoute === false || (options.accessibleRoute === true && dataStore.portals[tryPortal].accessible))) {
                        dataStore.portals[tryPortal].route = length + dataStore.portals[tryPortal].length;
                        dataStore.portals[tryPortal].prior = segment;
                        dataStore.portals[tryPortal].priormapNum = dataStore.paths[segmentFloor][segment].mapNum;
                        dataStore.portals[tryPortal].priorType = segmentType;
                        // if the incoming segment to the portal is at one end of the portal try all the paths at the other end
                        if ($.inArray(segment, dataStore.portals[tryPortal].connectionsA) !== -1) {
                            $.each(dataStore.portals[tryPortal].connectionsB, function (i, tryPath) {
                                //if adding this path
                                if (length + dataStore.portals[tryPortal].length + dataStore.paths[dataStore.portals[tryPortal].floorBNum][tryPath].length < dataStore.paths[dataStore.portals[tryPortal].floorBNum][tryPath].route) {
                                    dataStore.paths[dataStore.portals[tryPortal].floorBNum][tryPath].route = dataStore.portals[tryPortal].route + dataStore.paths[dataStore.portals[tryPortal].floorBNum][tryPath].length;
                                    dataStore.paths[dataStore.portals[tryPortal].floorBNum][tryPath].prior = tryPortal;
                                    dataStore.paths[dataStore.portals[tryPortal].floorBNum][tryPath].priorType = 'po';
                                    recursiveSearch('pa', dataStore.portals[tryPortal].floorBNum, tryPath, dataStore.paths[dataStore.portals[tryPortal].floorBNum][tryPath].route);
                                }
                            });
                        } else {
                            $.each(dataStore.portals[tryPortal].connectionsA, function (i, tryPath) {
                                // if adding this path
                                if (length + dataStore.portals[tryPortal].length + dataStore.paths[dataStore.portals[tryPortal].floorANum][tryPath].length < dataStore.paths[dataStore.portals[tryPortal].floorANum][tryPath].route) {
                                    dataStore.paths[dataStore.portals[tryPortal].floorANum][tryPath].route = dataStore.portals[tryPortal].route + dataStore.paths[dataStore.portals[tryPortal].floorANum][tryPath].length;
                                    dataStore.paths[dataStore.portals[tryPortal].floorANum][tryPath].prior = tryPortal;
                                    dataStore.paths[dataStore.portals[tryPortal].floorANum][tryPath].priorType = 'po';
                                    recursiveSearch('pa', dataStore.portals[tryPortal].floorANum, tryPath, dataStore.paths[dataStore.portals[tryPortal].floorANum][tryPath].route);
                                }
                            });
                        }
                    }
                });
            }

            options.wayFound = true;
        }

        // from a given end point generate an array representing the reverse steps needed to reach destination along shortest path
        function backTrack(segmentType, segmentFloor, segment) {
            var step;

            // if we aren't at the startpoint point
            if (segment !== 'door') {
                step = {};
                step.type = segmentType;
                step.floor = segmentFloor;
                step.segment = segment;
                solution.push(step);
                switch (segmentType) {
                    case 'pa':
                        backTrack(dataStore.paths[segmentFloor][segment].priorType, segmentFloor, dataStore.paths[segmentFloor][segment].prior);
                        break;
                    case 'po':
                        backTrack(dataStore.portals[segment].priorType, dataStore.portals[segment].priormapNum, dataStore.portals[segment].prior);
                        break;
                }
            }
        }

        function hidePath(obj) {
            $('path[class^=directionPath]', obj).css({
                'stroke': 'none'
            });
        }

        function animatePath(drawing, i) {
            var path,
                svg,
                pathRect,
                oldViewBox,
                drawLength,
                delay,
                pad = options.zoomPadding;

            if (1 !== 1 && i >= drawing.length) {
                // if repeat is set, then delay and rerun display from first.
                // Don't implement, until we have click to cancel out of this
                setTimeout(function () {
                        animatePath(drawing, 0);
                    },
                    5000);
            } else if (i >= drawing.length) {
                //finished, stop recursion.
                return;
            }

            drawLength = drawing[i].routeLength;
            delay = drawLength * options.path.speed;

            switchFloor(maps[drawing[i][0].floor].id, obj);

            path = $('#' + maps[drawing[i][0].floor].id + ' .directionPath' + i)[0];
            path.style.stroke = options.path.color;
            path.style.strokeWidth = options.path.width;
            path.style.transition = path.style.WebkitTransition = 'none';
            path.style.strokeDasharray = drawLength + ' ' + drawLength;
            path.style.strokeDashoffset = drawLength;
            pathRect = path.getBBox();
            path.style.transition = path.style.WebkitTransition = 'stroke-dashoffset ' + delay + 'ms linear';
            path.style.strokeDashoffset = '0';
// http://jakearchibald.com/2013/animated-line-drawing-svg/

            // Zooming logic...
            svg = $('#' + maps[drawing[i][0].floor].id + ' svg')[0];
            oldViewBox = svg.getAttribute('viewBox');

            if (options.zoomToRoute) {
                svg.setAttribute('viewBox', (pathRect.x - pad)  + ' ' + (pathRect.y - pad) +
                    ' ' + (pathRect.width + pad * 2) + ' ' + (pathRect.height + pad * 2));
            }

            setTimeout(function () {
                    animatePath(drawing, ++i);
                    svg.setAttribute('viewBox', oldViewBox); //zoom back out
                },
                delay + 1000);
        } //function animatePath

        //get the set of paths adjacent to a door or endpoint.
        function getDoorPaths(door) {
            var mapNum,
                pathNum,
                doorANum,
                doorBNum,
                result = {
                    'paths' : [],
                    'floor' : null
                };

            for (mapNum = 0; mapNum < maps.length; mapNum++) {
                for (pathNum = 0; pathNum < dataStore.paths[mapNum].length; pathNum++) {
                    for (doorANum = 0; doorANum < dataStore.paths[mapNum][pathNum].doorA.length; doorANum++) {
                        if (dataStore.paths[mapNum][pathNum].doorA[doorANum] === door) {
                            result.paths.push(pathNum); // only pushing pathNum because starting on a single floor
                            result.floor = dataStore.paths[mapNum][pathNum].floor;
                        }
                    }
                    for (doorBNum = 0; doorBNum < dataStore.paths[mapNum][pathNum].doorB.length; doorBNum++) {
                        if (dataStore.paths[mapNum][pathNum].doorB[doorBNum] === door) {
                            result.paths.push(pathNum); // only pushing pathNum because starting on a single floor
                            result.floor = dataStore.paths[mapNum][pathNum].floor;
                        }
                    }
                }
            }

            return result;
        }

        function getShortestRoute(destinations) {
            generateRoutes();

            function _minLengthRoute(destination) {
                var destInfo,
                    mapNum,
                    minPath,
                    reversePathStart,
                    destinationmapNum,
                    i;

                destInfo = getDoorPaths(destination);

                for (mapNum = 0; mapNum < maps.length; mapNum++) {
                    if (maps[mapNum].id === destInfo.floor) {
                        destinationmapNum = mapNum;
                    }
                }

                minPath = Infinity;
                reversePathStart = -1;

                for (i = 0; i < destInfo.paths.length; i++) {
                    if (dataStore.paths[destinationmapNum][destInfo.paths[i]].route < minPath) {
                        minPath = dataStore.paths[destinationmapNum][destInfo.paths[i]].route;
                        reversePathStart = destInfo.paths[i];
                    }
                }

                if (reversePathStart !== -1) {
                    solution = []; //can't be set in backtrack because it is recursive.
                    backTrack('pa', destinationmapNum, reversePathStart);
                    solution.reverse();

                    return {
                        'startpoint': startpoint,
                        'endpoint': destination,
                        'solution': solution,
                        'distance': minPath
                    };
                }

                return {
                    'startpoint': startpoint,
                    'endpoint': destination,
                    'solution': [],
                    'distance': minPath
                };
            }

            if (Array.isArray(destinations)) {
                return $.map(destinations, function (dest) {
                    return _minLengthRoute(dest);
                });
            } else {
                return _minLengthRoute(destinations);
            }

        }

        function generateRoutes() {
            var sourceInfo,
                mapNum,
                sourcemapNum;

            if (!options.wayFound) {
                sourceInfo = getDoorPaths(startpoint);

                for (mapNum = 0; mapNum < maps.length; mapNum++) {
                    if (maps[mapNum].id === sourceInfo.floor) {
                        sourcemapNum = mapNum;
                    }
                }

                prepareForSearch();
                $.each(sourceInfo.paths, function (i, pathId) {
                    dataStore.paths[sourcemapNum][pathId].route = dataStore.paths[sourcemapNum][pathId].length;
                    dataStore.paths[sourcemapNum][pathId].prior = 'door';
                    recursiveSearch('pa', sourcemapNum, pathId, dataStore.paths[sourcemapNum][pathId].length);
                });
                setOptions(obj);
            }
        }

        // The combined routing function
        // revise to only interate if startpoint has changed since last time?
        function routeTo(destination) {

            var i,
                draw,
                stepNum,
                level,
                reversePathStart,
                portalsEntered,
                lastStep,
                ax,
                ay,
                bx,
                by,
                aDX,
                aDY,
                bDX,
                bDY,
                cx,
                cy,
                px,
                py,
                curve,
                nx,
                ny,
                drawLength,
                thisPath,
                pick;

            options.endpoint = destination;

            // remove any prior paths from the current map set
            $('path[class^=directionPath]', obj).remove();

            //clear all rooms
            $('#Rooms *.wayfindingRoom', obj).removeAttr('class');


            solution = [];

            //if startpoint != destination
            if (startpoint !== destination) {

                // get accessibleRoute option -- options.accessibleRoute

                //hilight the destination room
                $('#Rooms a[id="' + destination + '"] g', obj).attr('class', 'wayfindingRoom');

                solution = getShortestRoute(destination).solution;

                if (reversePathStart !== -1) {

                    portalsEntered = 0;
                    //count number of portal trips
                    for (i = 0; i < solution.length; i++) {
                        if (solution[i].type === 'po') {
                            portalsEntered++;
                        }
                    }

                    //break this into a new function?

                    drawing = new Array(portalsEntered); // Problem at line 707 character 40: Use the array literal notation [].

                    drawing[0] = [];

                    //build drawing and modify solution for text generation by adding .direction to solution segments?

                    draw = {};

                    //if statement incorrectly assumes one door at the end of the path, works in that case, need to generalize
                    if (dataStore.paths[solution[0].floor][solution[0].segment].doorA[0] === startpoint) {
                        draw = {};
                        draw.floor = [solution[0].floor];
                        draw.type = 'M';
                        draw.x = dataStore.paths[solution[0].floor][solution[0].segment].ax;
                        draw.y = dataStore.paths[solution[0].floor][solution[0].segment].ay;
                        draw.length = 0;
                        drawing[0].push(draw);
                        draw = {};
                        draw.type = 'L';
                        draw.floor = [solution[0].floor];
                        draw.x = dataStore.paths[solution[0].floor][solution[0].segment].bx;
                        draw.y = dataStore.paths[solution[0].floor][solution[0].segment].by;
                        draw.length = dataStore.paths[solution[0].floor][solution[0].segment].length;
                        drawing[0].push(draw);
                        drawing[0].routeLength = draw.length;
                    } else if (dataStore.paths[solution[0].floor][solution[0].segment].doorB[0] === startpoint) {
                        draw = {};
                        draw.type = 'M';
                        draw.floor = [solution[0].floor];
                        draw.x = dataStore.paths[solution[0].floor][solution[0].segment].bx;
                        draw.y = dataStore.paths[solution[0].floor][solution[0].segment].by;
                        draw.length = 0;
                        drawing[0].push(draw);
                        draw = {};
                        draw.type = 'L';
                        draw.floor = [solution[0].floor];
                        draw.x = dataStore.paths[solution[0].floor][solution[0].segment].ax;
                        draw.y = dataStore.paths[solution[0].floor][solution[0].segment].ay;
                        draw.length = dataStore.paths[solution[0].floor][solution[0].segment].length;
                        drawing[0].push(draw);
                        drawing[0].routeLength = draw.length;
                    }

                    lastStep = 1;

                    // for each floor that we have to deal with
                    for (i = 0; i < portalsEntered + 1; i++) {
                        for (stepNum = lastStep; stepNum < solution.length; stepNum++) {
                            if (solution[stepNum].type === 'pa') {
                                ax = dataStore.paths[solution[stepNum].floor][solution[stepNum].segment].ax;
                                ay = dataStore.paths[solution[stepNum].floor][solution[stepNum].segment].ay;
                                bx = dataStore.paths[solution[stepNum].floor][solution[stepNum].segment].bx;
                                by = dataStore.paths[solution[stepNum].floor][solution[stepNum].segment].by;

                                draw = {};
                                draw.floor = solution[stepNum].floor;
                                if (drawing[i].slice(-1)[0].x === ax && drawing[i].slice(-1)[0].y === ay) {
                                    draw.x = bx;
                                    draw.y = by;
                                } else {
                                    draw.x = ax;
                                    draw.y = ay;
                                }
                                draw.length = dataStore.paths[solution[stepNum].floor][solution[stepNum].segment].length;
                                draw.type = 'L';
                                drawing[i].push(draw);
                                drawing[i].routeLength += draw.length;
                            }
                            if (solution[stepNum].type === 'po') {
                                drawing[i + 1] = [];
                                drawing[i + 1].routeLength = 0;
                                // push the first object on
                                // check for more than just floor number here....
                                pick = '';
                                if (dataStore.portals[solution[stepNum].segment].floorANum === dataStore.portals[solution[stepNum].segment].floorBNum) {
                                    if (dataStore.portals[solution[stepNum].segment].xA === draw.x && dataStore.portals[solution[stepNum].segment].yA === draw.y) {
                                        pick = 'B';
                                    } else {
                                        pick = 'A';
                                    }
                                } else {
                                    if (dataStore.portals[solution[stepNum].segment].floorANum === solution[stepNum].floor) {
                                        pick = 'A';
                                    } else if (dataStore.portals[solution[stepNum].segment].floorBNum === solution[stepNum].floor) {
                                        pick = 'B';
                                    }
                                }
                                if (pick === 'A') {
                                    draw = {};
                                    draw.floor = solution[stepNum].floor;
                                    draw.type = 'M';
                                    draw.x = dataStore.portals[solution[stepNum].segment].xA;
                                    draw.y = dataStore.portals[solution[stepNum].segment].yA;
                                    draw.length = 0;
                                    drawing[i + 1].push(draw);
                                    drawing[i + 1].routeLength = draw.length;
                                } else if (pick === 'B') {
                                    draw = {};
                                    draw.floor = solution[stepNum].floor;
                                    draw.type = 'M';
                                    draw.x = dataStore.portals[solution[stepNum].segment].xB;
                                    draw.y = dataStore.portals[solution[stepNum].segment].yB;
                                    draw.length = 0;
                                    drawing[i + 1].push(draw);
                                    drawing[i + 1].routeLength = draw.length;
                                }
                                lastStep = stepNum;
                                lastStep++;
                                stepNum = solution.length;
                            }
                        }
                    }

                    //go back through the drawing and insert curves if requested
                    //consolidate colinear line segments?
                    if (options.path.radius > 0) {
                        for (level = 0; level < drawing.length; level++) {
                            for (i = 1; i < drawing[level].length - 1; i++) {
                                if (drawing[level][i].type === 'L' && drawing[level][i].type === 'L') {
                                    // check for colinear here and remove first segment, and add its length to second
                                    aDX = (drawing[level][i - 1].x - drawing[level][i].x);
                                    aDY = (drawing[level][i - 1].y - drawing[level][i].y);
                                    bDX = (drawing[level][i].x - drawing[level][i + 1].x);
                                    bDY = (drawing[level][i].y - drawing[level][i + 1].y);
                                    // if the change in Y for both is Zero
                                    if ((aDY === 0 && bDY === 0) || (aDX === 0 && bDX === 0) || ((aDX / aDY) === (bDX / bDY) && !(aDX === 0 && aDY === 0 && bDX === 0 && bDY === 0))) {
                                        drawing[level][i + 1].length = drawing[level][i].length + drawing[level][i + 1].length;
//                                      drawing[level][i+1].type = "L";
                                        drawing[level].splice(i, 1);
                                        i = 1;
                                    }
                                }
                            }
                            for (i = 1; i < drawing[level].length - 1; i++) {
                                // locate possible curves based on both line segments being longer than options.path.radius
                                if (drawing[level][i].type === 'L' && drawing[level][i].type === 'L' && drawing[level][i].length > options.path.radius && drawing[level][i + 1].length > options.path.radius) {
                                    //save old end point
                                    cx = drawing[level][i].x;
                                    cy = drawing[level][i].y;
                                    // change x,y and change length
                                    px = drawing[level][i - 1].x;
                                    py = drawing[level][i - 1].y;
                                    //new=prior + ((center-prior) * ((length-radius)/length))
                                    drawing[level][i].x = (Number(px) + ((cx - px) * ((drawing[level][i].length - options.path.radius) / drawing[level][i].length)));
                                    drawing[level][i].y = (Number(py) + ((cy - py) * ((drawing[level][i].length - options.path.radius) / drawing[level][i].length)));
                                    //shorten current line
                                    drawing[level][i].length = drawing[level][i].length - options.path.radius;
                                    curve =  {};
                                    //curve center is old end point
                                    curve.cx = cx;
                                    curve.cy = cy;
                                    //curve end point is based on next line
                                    nx = drawing[level][i + 1].x;
                                    ny = drawing[level][i + 1].y;
                                    curve.x = (Number(cx) + ((nx - cx) * ((options.path.radius) / drawing[level][i + 1].length)));
                                    curve.y = (Number(cy) + ((ny - cy) * ((options.path.radius) / drawing[level][i + 1].length)));
                                    //change length of next segment now that it has a new starting point
                                    drawing[level][i + 1].length = drawing[level][i + 1].length - options.path.radius;
                                    curve.type = 'Q';
                                    curve.floor = drawing[level][i].floor;
                                    // insert curve element
                                    // splice function on arrays allows insertion
                                    //   array.splice(start, delete count, value, value)
                                    // drawing[level].splice(current line, 0, curve element object);

                                    drawing[level].splice(i + 1, 0, curve);

                                } // both possible segments long enough
                            } // drawing segment
                        } // level
                    } // if we are doing curves at all

                    $.each(drawing, function (i, level) {
                        var path = '',
                            newPath;
                        $.each(level, function (j, stroke) {
                            switch (stroke.type) {
                                case 'M':
                                    path = 'M' + stroke.x + ',' + stroke.y;
                                    break;
                                case 'L':
                                    path += 'L' + stroke.x + ',' + stroke.y;
//                              maps[level[0].floor].svgHandle.circle(stroke.x,stroke.y,2);
                                    break;
                                case 'Q':
                                    path += 'Q' + stroke.cx + ',' + stroke.cy + ' ' + stroke.x + ',' + stroke.y;
//                              maps[level[0].floor].svgHandle.circle(stroke.cx,stroke.cy,4);
//                              maps[level[0].floor].svgHandle.circle(stroke.x,stroke.y,2);
                                    break;
                            }
                        });

                        newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        newPath.setAttribute('d', path);
                        newPath.style.fill = 'none';
                        if (newPath.classList) {
                            newPath.classList.add('directionPath' + i);
                        } else {
                            newPath.setAttribute('class', 'directionPath' + i);
                        }

                        /** MODIFIED BY TODARO C. **/
                        /** Modificato affinchè l'inserimento del best path avvenga all'interno dell'elemento <g>
                         che raggruppa tutti gli elementi della mappa su cui fare lo zoom (ciò permette che lo zoom della mappa
                         con D3 avvenga anche sul path trovato oltre che sulla mappa) **/
                        //$('#' + maps[level[0].floor].id + ' svg').append(newPath);
                        $('#' + maps[level[0].floor].id + ' svg g').first().append(newPath);

                        thisPath = $('#' + maps[level[0].floor].id + ' svg .directionPath' + i);

                        drawing[i].path = thisPath;

                        drawLength = drawing[i].routeLength;

                    });

                    animatePath(drawing, 0);

                    //on switch which floor is displayed reset path svgStrokeDashOffset to minPath and the reanimate
                    //notify animation loop?

                }  /*else {
					// respond that path not found
				console.log("path not found from " + startpoint + " to " + destination);
			}*/
            }
        } //RouteTo

        function checkMap(el) {

            var mapNum,
                pathNum,
                debugLine,
                report = [],
                i = 0;

            generateRoutes();

            for (mapNum = 0; mapNum < maps.length; mapNum++) {
                report[i++] = 'Checking map: ' + mapNum;
                for (pathNum = 0; pathNum < dataStore.paths[mapNum].length; pathNum++) {
                    if (dataStore.paths[mapNum][pathNum].route === Infinity || dataStore.paths[mapNum][pathNum].prior === -1) {
                        report[i++] = 'unreachable path: ' + pathNum;
                        //Show where paths that are unreachable from the given start point are.
                        debugLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        debugLine.setAttribute('class', 'debugPath');
                        debugLine.setAttribute('x1', dataStore.paths[mapNum][pathNum].ax);
                        debugLine.setAttribute('y1', dataStore.paths[mapNum][pathNum].ay);
                        debugLine.setAttribute('x2', dataStore.paths[mapNum][pathNum].bx);
                        debugLine.setAttribute('y2', dataStore.paths[mapNum][pathNum].by);
                        $('#' + dataStore.paths[mapNum][pathNum].floor + ' #Paths', el).append(debugLine);
                    }
                }
                report[i++] = '\n';

                /* jshint ignore:start */
                $('#' + dataStore.paths[mapNum][0].floor + ' #Rooms a', el).each(function (_i, room) {
                    var doorPaths = getShortestRoute($(room).prop('id'));

                    if (doorPaths.solution.length === 0) {
                        report[i++] = 'unreachable room: ' + $(room).prop('id');
                        //highlight unreachable rooms
                        $(room).attr('class', 'debugRoom');
                    }
                }); //
                /* jshint ignore:end */
                report[i++] = '\n';
            }

            return report.join('\n');
        } // checkMap function





        if (action && typeof (action) === 'object') {
            options = action;
            action = 'initialize';
        }

        // для каждого целевого объекта jQuery
        this.each(function () {


            // сохранить ссылку на текущий обрабатываемый объект jQuery
            obj = $(this);

            getOptions(obj); // загрузить текущие варианты



            //обработка действий
            if (action && typeof (action) === 'string') {
                switch (action) {
                    case 'initialize':
                        checkIds();
                        initialize(obj);
                        break;
                    case 'routeTo':

                        routeTo(passed);
                        break;
                    case 'animatePath':
                        hidePath(obj);
                        animatePath(drawing, 0);
                        break;
                    case 'startpoint':

                        if (passed === undefined) {
                            result = startpoint;
                        } else {
                            options.wayFound = false;
                            setStartPoint(passed);
                        }
                        break;
                    case 'currentMap':

                        if (passed === undefined) {
                            result = $('div:visible', obj).prop('id');
                        } else {
                            switchFloor(passed, obj);
                        }
                        break;
                    case 'accessibleRoute':

                        if (passed === undefined) {
                            result = options.accessibleRoute;
                        } else {
                            if (options.accessibleRoute !== passed) {
                                options.wayFound = false;
                            }
                            options.accessibleRoute = passed;
                        }
                        break;
                    case 'path':

                        if (passed === undefined) {
                            result = options.path;
                        } else {
                            options.path = $.extend(true, {}, options.path, passed);
                        }
                        break;
                    case 'checkMap':

                        result = checkMap(obj);
                        break;
                    case 'getDataStore':
                        //показывает версию dataStore в формате JSON при вызове с консоли.
                        //Для облегчения кэширования dataStore.
                        result = JSON.stringify(dataStore);
                        $('body').replaceWith(result);
                        break;
                    case 'getRoutes':
                        //получает длину кратчайшего маршрута
                        //
                        if (passed === undefined) {
                            result = getShortestRoute(options.endpoint);
                        } else {
                            result = getShortestRoute(passed);
                        }
                        break;
                    case 'destroy':
                        //удалить все следы навигации с объекта
                        $(obj).remove();
                        break;
                    default:
                        break;
                }
            }
            //
            setOptions(obj);

        });


        if (result !== undefined) {
            return result;
        }
        return this;

    }; // wayfinding function

}(jQuery));

//  ]]>
