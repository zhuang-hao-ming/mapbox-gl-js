'use strict';

/* global d3 */

const versionColor = d3.scaleOrdinal(d3.schemeCategory10);
versionColor(0); // Skip blue -- too similar to link color.

const formatSample = d3.format(".3r");

class Plot extends React.Component {
    render() {
        return <svg width="100%" style={{overflow: 'visible'}} ref={node => { this.node = node; }}></svg>;
    }

    componentDidMount() {
        this.plot();
    }

    componentDidUpdate() {
        this.plot();
    }
}

class StatisticsPlot extends Plot {
    plot() {
        function kernelDensityEstimator(kernel, ticks) {
            return function(samples) {
                if (samples.length === 0) {
                    return [];
                }
                // https://en.wikipedia.org/wiki/Kernel_density_estimation#A_rule-of-thumb_bandwidth_estimator
                const bandwidth = 1.06 * d3.deviation(samples) * Math.pow(samples.length, -0.2);
                return ticks.map((x) => {
                    return [x, d3.mean(samples, (v) => kernel((x - v) / bandwidth)) / bandwidth];
                });
            };
        }

        function kernelEpanechnikov(v) {
            return Math.abs(v) <= 1 ? 0.75 * (1 - v * v) : 0;
        }

        const margin = {top: 0, right: 20, bottom: 20, left: 0},
            width = this.node.clientWidth - margin.left - margin.right,
            height = 400 - margin.top - margin.bottom,
            kdeWidth = 100;

        const t = d3.scaleLinear()
            .domain([0, d3.max(this.props.versions.map(v => d3.max(v.samples)))])
            .range([height, 0])
            .nice();

        const b = d3.scaleBand()
            .domain(this.props.versions.map(v => v.name))
            .range([kdeWidth + 20, width])
            .paddingOuter(0.15)
            .paddingInner(0.3);

        const kde = kernelDensityEstimator(kernelEpanechnikov, t.ticks(50));
        const versions = this.props.versions.map(v => ({
            name: v.name,
            samples: v.samples,
            density: kde(v.samples)
        }));

        const p = d3.scaleLinear()
            .domain([0, d3.max(versions.map(v => d3.max(v.density, d => d[1])))])
            .range([0, kdeWidth]);

        let svg = d3.select(this.node)
            .attr("height", height + margin.top + margin.bottom)
            .selectAll("g")
            .data([0]);

        const enter = svg.enter()
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        enter
            .append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(p).ticks(2, "%"));

        enter
            .append("g")
            .call(d3.axisLeft(t).tickFormat(formatSample))
            .append("text")
            .attr("fill", "#000")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Time (ms)");

        svg = enter.merge(svg);

        const density = svg.selectAll(".density")
            .data(versions);

        density.enter().append("path")
            .attr("class", "density")
            .attr("fill", "none")
            .attr("stroke", v => versionColor(v.name))
            .attr("stroke-opacity", 0.7)
            .attr("stroke-width", 2)
            .merge(density)
            .attr("d", v => d3.line()
                .curve(d3.curveBasis)
                .y(d => t(d[0]))
                .x(d => p(d[1]))(v.density));

        let group = svg.selectAll('.version')
            .data(versions);

        group = group.enter().append("g")
            .attr("class", "version")
            .attr("transform", v => `translate(${b(v.name)},0)`)
            .merge(group)
            .each((v, i, nodes) => {
                if (v.samples.length === 0)
                    return;

                const bandwidth = b.bandwidth();
                const group = d3.select(nodes[i]);
                const color = versionColor(v.name);
                const scale = d3.scaleLinear()
                    .domain([0, v.samples.length])
                    .range([0, bandwidth]);

                const sorted = v.samples.slice().sort(d3.ascending);
                const [q1, q2, q3] = [.25, .5, .75].map((d) => d3.quantile(sorted, d));
                const mean = d3.mean(sorted);

                let min = [NaN, Infinity];
                let max = [NaN, -Infinity];
                for (let i = 0; i < v.samples.length; i++) {
                    const s = v.samples[i];
                    if (s < min[1]) min = [i, s];
                    if (s > max[1]) max = [i, s];
                }

                let samples = group.selectAll("circle")
                    .data(v.samples);

                samples.enter().append("circle")
                    .attr("r", (d, i) => i === min[0] || i === max[0] ? 2 : 1)
                    .attr("fill", color)
                    .merge(samples);

                samples
                    .attr("cx", (d, i) => scale(i))
                    .attr("cy", d => t(d));

                const quartiles = group.selectAll("line.quartiles")
                    .data([0]);

                quartiles.enter().append("line")
                    .attr("class", "quartiles")
                    .attr("x1", bandwidth / 2)
                    .attr("x2", bandwidth / 2)
                    .attr("stroke", color)
                    .attr("stroke-width", bandwidth)
                    .attr("stroke-opacity", 0.5)
                    .merge(quartiles)
                    .attr("y1", t(q1))
                    .attr("y2", t(q3));

                const medianLine = group.selectAll("line.median")
                    .data([0]);

                medianLine.enter().append("line")
                    .attr("class", "median")
                    .attr("x1", bandwidth / 2)
                    .attr("x2", bandwidth / 2)
                    .attr("stroke", color)
                    .attr("stroke-width", bandwidth)
                    .attr("stroke-opacity", 1)
                    .merge(medianLine)
                    .attr("y1", t(q2) - 0.5)
                    .attr("y2", t(q2) + 0.5);

                const meanLine = group.selectAll("line.mean")
                    .data([0]);

                meanLine.enter().append("line")
                    .attr("class", "mean")
                    .attr("x1", bandwidth / 2)
                    .attr("x2", bandwidth / 2)
                    .attr("stroke", "white")
                    .attr("stroke-width", bandwidth)
                    .attr("stroke-opacity", 1)
                    .merge(meanLine)
                    .attr("y1", t(mean) - 0.5)
                    .attr("y2", t(mean) + 0.5);

                const rightLabels = group.selectAll("text.right")
                    .data([q1, q2, q3], Number);

                rightLabels.enter().append("text")
                    .attr("class", "right")
                    .attr("dy", ".3em")
                    .attr("dx", 6)
                    .attr("x", bandwidth)
                    .attr("font-size", 10)
                    .attr("font-family", "sans-serif")
                    .text(formatSample)
                    .merge(rightLabels)
                    .attr("y", t);

                const leftLabels = group.selectAll("text.left")
                    .data([mean], Number);

                leftLabels.enter().append("text")
                    .attr("class", "left")
                    .attr("dy", ".3em")
                    .attr("dx", -6)
                    .attr("x", 0)
                    .attr("text-anchor", "end")
                    .attr("font-size", 10)
                    .attr("font-family", "sans-serif")
                    .text(formatSample)
                    .merge(leftLabels)
                    .attr("y", t);

                const extentLabels = group.selectAll("text.extent")
                    .data([min, max]);

                extentLabels.enter().append("text")
                    .attr("class", "extent")
                    .attr("dy", (d, i) => i === 0 ? "1.3em" : "-0.7em")
                    .attr("x", d => scale(d[0]))
                    .attr("text-anchor", "middle")
                    .attr("font-size", 10)
                    .attr("font-family", "sans-serif")
                    .text(d => formatSample(d[1]))
                    .merge(extentLabels)
                    .attr("y", d => t(d[1]));
            });
    }
}

function regression(samples) {
    const result = [];
    for (let i = 0, n = 1; i + n < samples.length; i += n, n++) {
        result.push([n, samples.slice(i, i + n).reduce(((sum, sample) => sum + sample), 0)]);
    }
    return result;
}

class RegressionPlot extends Plot {
    plot() {
        const margin = {top: 10, right: 20, bottom: 30, left: 0},
            width = this.node.clientWidth - margin.left - margin.right,
            height = 200 - margin.top - margin.bottom;

        const versions = this.props.versions.filter(version => version.regression);

        const x = d3.scaleLinear()
            .domain([0, d3.max(versions.map(version => d3.max(version.regression.data, d => d[0])))])
            .range([0, width])
            .nice();

        const y = d3.scaleLinear()
            .domain([0, d3.max(versions.map(version => d3.max(version.regression.data, d => d[1])))])
            .range([height, 0])
            .nice();

        const line = d3.line()
            .x(d => x(d[0]))
            .y(d => y(d[1]));

        let svg = d3.select(this.node)
            .attr("height", height + margin.top + margin.bottom)
            .selectAll("g")
            .data([0]);

        const enter = svg.enter()
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        enter
            .append("g")
            .attr("class", "x axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .append("text")
            .attr("fill", "#000")
            .attr("x", width)
            .attr("y", -6)
            .style("text-anchor", "end")
            .text("Iterations");

        enter
            .append("g")
            .attr("class", "y axis")
            .call(d3.axisLeft(y).ticks(4).tickFormat(formatSample))
            .append("text")
            .attr("fill", "#000")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Time (ms)");

        svg = enter.merge(svg);

        let group = svg.selectAll(".version")
            .data(versions);

        group = group.enter().append("g")
            .attr("class", "version")
            .style("fill", version => versionColor(version.name))
            .style("fill-opacity", 0.7)
            .merge(group);

        let regressionPoints = group.selectAll("circle")
            .data(version => version.regression.data);

        regressionPoints = regressionPoints.enter().append("circle")
            .attr("r", 2)
            .merge(regressionPoints);

        regressionPoints
            .attr("cx", d => x(d[0]))
            .attr("cy", d => y(d[1]));

        let regressionLine = group.selectAll('.regression-line')
            .data((version) => [version]);

        regressionLine = regressionLine.enter().append('path')
            .attr('class', 'regression-line')
            .attr('stroke', version => versionColor(version.name))
            .attr('stroke-width', 1)
            .attr('stroke-opacity', 0.5)
            .merge(regressionLine);

        regressionLine.attr('d', version => line(version.regression.data.map(d => [
            d[0],
            d[0] * version.regression.slope + version.regression.intercept
        ])));
    }
}

class BenchmarkStatistic extends React.Component {
    render() {
        switch (this.props.status) {
        case 'waiting':
            return <p className="quiet"></p>;
        case 'running':
            return <p>Running...</p>;
        case 'error':
            return <p>{this.props.error.message}</p>;
        default:
            return <p>{this.props.statistic(this.props)}</p>;
        }
    }
}

class BenchmarkRow extends React.Component {
    render() {
        const ended = this.props.versions.find(version => version.status === 'ended');
        return (
            <div className="col12 clearfix space-bottom">
                <h2 className="col4"><a href={`#${this.props.name}`} onClick={this.reload}>{this.props.name}</a></h2>
                <div className="col8">
                    <table className="fixed space-bottom">
                        <tr><th></th>{this.props.versions.map(version => <th style={{color: versionColor(version.name)}} key={version.name}>{version.name}</th>)}</tr>
                        {this.renderStatistic('R² Slope / Correlation',
                            (version) => `${formatSample(version.regression.slope)} ms / ${version.regression.correlation.toFixed(3)} ${
                                version.regression.correlation < 0.9 ? '\u2620\uFE0F' :
                                version.regression.correlation < 0.99 ? '\u26A0\uFE0F' : ''}`)}
                        {this.renderStatistic('Mean',
                            (version) => `${formatSample(d3.mean(version.samples))} ms`)}
                        {this.renderStatistic('Minimum',
                            (version) => `${formatSample(d3.min(version.samples))} ms`)}
                        {this.renderStatistic('Variance',
                            (version) => `${formatSample(d3.variance(version.samples))} ms`)}
                        {this.renderStatistic('Deviation',
                            (version) => `${formatSample(d3.deviation(version.samples))} ms`)}
                    </table>
                    {ended && <StatisticsPlot versions={this.props.versions}/>}
                    {ended && <RegressionPlot versions={this.props.versions}/>}
                </div>
            </div>
        );
    }

    renderStatistic(title, statistic) {
        return (
            <tr>
                <th>{title}</th>
                {this.props.versions.map(version =>
                    <td key={version.name}><BenchmarkStatistic statistic={statistic} {...version}/></td>
                )}
            </tr>
        );
    }

    reload() {
        location.reload();
    }
}

class BenchmarksTable extends React.Component {
    render() {
        return (
            <div style={{width: 960, margin: '2em auto'}}>
                <h1 className="space-bottom1">Mapbox GL JS Benchmarks</h1>
                {this.props.benchmarks.map(benchmark => <BenchmarkRow key={benchmark.name} {...benchmark}/>)}
            </div>
        );
    }
}

const versions = window.mapboxglVersions;
const benchmarks = [];
const filter = window.location.hash.substr(1);

let finished = false;
let promise = Promise.resolve();

for (const name in window.mapboxglBenchmarks) {
    if (filter && name !== filter)
        continue;

    const benchmark = { name, versions: [] };
    benchmarks.push(benchmark);

    for (const ver in window.mapboxglBenchmarks[name]) {
        const version = {
            name: ver,
            status: 'waiting',
            logs: [],
            samples: []
        };

        benchmark.versions.push(version);

        promise = promise.then(() => {
            version.status = 'running';
            update();

            return window.mapboxglBenchmarks[name][ver].run()
                .then(samples => {
                    version.status = 'ended';
                    version.samples = samples;
                    version.regression = leastSquaresRegression(regression(samples));
                    update();
                })
                .catch(error => {
                    version.status = 'errored';
                    version.error = error;
                    update();
                });
        });
    }
}

promise = promise.then(() => {
    finished = true;
    update();
});

function update() {
    ReactDOM.render(
        <BenchmarksTable versions={versions} benchmarks={benchmarks} finished={finished}/>,
        document.getElementById('benchmarks')
    );
}

function leastSquaresRegression(data) {
    const meanX = d3.sum(data, d => d[0]) / data.length;
    const meanY = d3.sum(data, d => d[1]) / data.length;
    const varianceX = d3.variance(data, d => d[0]);
    const sdX = Math.sqrt(varianceX);
    const sdY = d3.deviation(data, d => d[1]);
    const covariance = d3.sum(data, ([x, y]) =>
        (x - meanX) * (y - meanY)
    ) / (data.length - 1);

    const correlation = covariance / sdX / sdY;
    const slope = covariance / varianceX;
    const intercept = meanY - slope * meanX;

    return { correlation, slope, intercept, data };
}
