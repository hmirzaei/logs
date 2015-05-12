//=require_tree ../../../vendor/assets/javascripts/.

var ready;
ready = function () {
    function responsivefy(svg) {
        // get container + svg aspect ratio
        var container = d3.select(svg.node().parentNode);
        d3.select(window).on("resize." + container.attr("id"), resize);

        // get width of container and resize svg to fit it
        function resize() {
            draw();
        }
    }

    var brushWidth = 40;
    var logField = "Task Duration";

    var margin, margin2, width, height, height2, barX, x2, y, y2, xAxis, xAxis2, yAxis, yAxis2, brush, area2, svg;
    var focus, context;
    var prevExtentStart, prevExtentEnd;
    var focusData;

    function draw() {
        var divWidth = parseInt(d3.select("#barchart").style("width"));
        var divHeight = parseInt(d3.select("#barchart").style("height"));


        margin = {top: 10, right: 10, bottom: 120, left: 70};
        margin2 = {top: divHeight - 70, right: 10, bottom: 20, left: 70};
        width = divWidth - margin.left - margin.right;
        height = divHeight - margin.top - margin.bottom;
        height2 = divHeight - margin2.top - margin2.bottom;

        barX = d3.scale.ordinal().rangeRoundBands([0, width], 0.1);
        x2 = d3.scale.linear().range([0, width]);
        y = d3.scale.linear().range([height, 0]);
        y2 = d3.scale.linear().range([height2, 0]);
        x2.domain([0, spark_log.length]);


        xAxis = d3.svg.axis().scale(barX).orient("bottom");
        xAxis2 = d3.svg.axis().scale(x2).orient("bottom");
        yAxis = d3.svg.axis().scale(y).orient("left");
        yAxis2 = d3.svg.axis().scale(y2).orient("left").ticks(4);

        brush = d3.svg.brush()
            .x(x2)
            .extent([0, brushWidth])
            .on("brush", brushed)
            .on("brushend", brushended);

        prevExtentStart = Math.round(brush.extent()[0]);
        prevExtentEnd = Math.round(brush.extent()[1]);

        area2 = d3.svg.area()
            .interpolate("step")
            .x(function (d, i) {
                return x2(i);
            })
            .y0(height2)
            .y1(function (d) {
                return y2(d[logField]);
            });

        d3.select("#barchart").select("svg").remove();
        svg = d3.select("#barchart").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .call(responsivefy);

        svg.append("defs").append("clipPath")
            .attr("id", "clip")
            .append("rect")
            .attr("width", width)
            .attr("height", height);

        focus = svg.append("g")
            .attr("class", "focus")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        context = svg.append("g")
            .attr("class", "context")
            .attr("transform", "translate(" + margin2.left + "," + margin2.top + ")");

        tip = d3.tip()
            .attr('class', 'd3-tip')
            .offset([-10, 0])
            .html(function (d) {
                return "<span>Job ID:</spa> <span style='color:deepskyblue'>" + d["Job ID"] + "</span><br/>" +
                    "<span>Stage ID:</spa> <span style='color:deepskyblue'>" + d["Stage ID"] + "</span><br/>" +
                    "<span>Task ID:</spa> <span style='color:deepskyblue'>" + d["Task ID"] + "</span><br/>" +
                    "<span>" + logField + "</spa> <span style='color:deepskyblue'>" + d[logField] + "</span><br/>";
            });

        svg.call(tip);

        y.domain([0, d3.max(spark_log.map(function (d) {
            return d[logField];
        }))]);
        x2.domain([0, spark_log.length]);

        y2.domain(y.domain());

        focusData = spark_log.slice(brush.extent()[0], brush.extent()[1]);
        barX.domain(focusData.map(function (d) {
            return d["Task ID"];
        }));

        focus.append("svg")
            .attr("class", "bars")
            .selectAll("rect")
            .data(focusData)
            .enter()
            .append("rect")
            .filter(function (d) {
                return (barX(d["Task ID"]) != null)
            })
            .attr("x", function (d) {
                return barX(d["Task ID"]);
            })
            .attr("y", function (d) {
                return y(d[logField]);
            })
            .attr("width", barX.rangeBand())
            .attr("height", function (d) {
                return height - y(d[logField]);
            })
            .on('mouseover', tip.show)
            .on('mouseout', tip.hide);


        focus.append("g")
            .attr("class", "barx axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis).selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", function (d) {
                return "rotate(-65)"
            });

        focus.append("g")
            .attr("class", "y axis")
            .call(yAxis);

        context.append("path")
            .datum(spark_log)
            .attr("class", "area")
            .attr("d", area2);

        context.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height2 + ")")
            .call(xAxis2);

        context.append("g")
            .attr("class", "y2 axis")
            .call(yAxis2);

        context.append("g")
            .attr("class", "x brush")
            .call(brush)
            .selectAll("rect")
            .attr("y", -6)
            .attr("height", height2 + 7);
    }

    draw();

    {

        function brushed() {


            var extentStart = Math.round(brush.extent()[0]);
            var extentEnd = Math.round(brush.extent()[1]);


            focusData = spark_log.slice(extentStart, extentEnd);

            //prevExtentStart = extentStart;
            //prevExtentEnd = extentEnd;

            barX.domain(focusData.map(function (d) {
                return d["Task ID"];
            }));

            y.domain([0, d3.max(focusData.map(function (d) {
                return d[logField];
            }))]);

            focus.select(".barx.axis").call(xAxis).selectAll("text")
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", function (d) {
                    return "rotate(-65)"
                });
            focus.select(".y.axis").call(yAxis);


            var bars = focus.select(".bars").selectAll("rect").data(focusData);

            bars.enter()
                .append("rect")
                .attr("x", width)
                .attr("y", function (d) {
                    return y(d[logField]);
                })
                .attr("width", barX.rangeBand())
                .attr("height", function (d) {
                    return height - y(d[logField]);
                })
                .on('mouseover', tip.show)
                .on('mouseout', tip.hide);

            bars.transition().duration(600).ease("elastic")
                .attr("x", function (d) {
                    return barX(d["Task ID"]);
                })
                .attr("y", function (d) {
                    return y(d[logField]);
                })
                .attr("width", barX.rangeBand())
                .attr("height", function (d) {
                    return height - y(d[logField]);
                });

            bars.exit().transition().duration(600).ease("elastic")
                .attr("height", 0)
                .attr("y", height)
                .remove();


        }

        function brushended() {
            if (brush.extent()[1] - brush.extent()[0] < brushWidth * 0.9) {
                var extent1 = [brush.extent()[0] - brushWidth / 2, brush.extent()[1] + brushWidth / 2]
                if (extent1[0] < 0) {
                    extent1 = [0, brushWidth];
                }
                if (extent1[1] > spark_log.length) {
                    extent1 = [spark_log.length - brushWidth - 1, spark_log.length - 1];
                }


                context.select(".x.brush").transition().duration(600).ease('elastic').call(brush.extent(extent1));
                context.select(".x.brush").call(brush.event);
            }
        }

        window.fieldChanged = function (value) {
            logField = value;

            y2.domain([0, d3.max(spark_log.map(function (d) {
                return d[logField];
            }))]);

            context.select(".y2.axis").call(yAxis2);
            context.select(".area").datum(spark_log).transition().duration(600).ease("elastic").attr("d", area2);

            context.select(".x.brush").call(brush.event);
        }
    }
};

$(document).ready(ready);
$(document).on('page:load', ready);



