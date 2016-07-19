var documentation = require('documentation');

documentation(['/Users/lucaswoj/Documents/mapbox/mapbox-gl-js/js/mapbox-gl.js'], {access: ['public', 'undefined']}, function(err, statements) {
    if (err) throw err;
    console.log(statements.map(formatStatement).filter(Boolean).join('\n\n'));
});

function formatStatement(expression) {
    if (expression.kind === 'typedef') {
        return 'type ' + expression.name + ' = ' + formatTypeExpression(expression.type, expression) + ';';
    }
}

function formatTypeExpression(type, expression) {

    if (type.type === 'NameExpression' && type.name === 'Object' && (expression && expression.properties)) {
        return surround('{', '}', expression.properties.map(function(property) {
            console.log(JSON.stringify(property));
            return property.name + ': ' + property.type.name;
        }).join(',\n'));

    } else if (type.type === 'NameExpression' && type.name === 'Array' && expression.applications.length === 1) {
        return 'Array<' + formatTypeExpression(expression.applications[0]) + '>';

    } else if (type.type === 'NameExpression') {
        return type.name;

    } else if (type.type === 'UnionType') {
        return surround('(', ')', type.elements.map(formatTypeExpression).join(' |\n'));

    } else if (type.type === 'TypeApplication') {
        return formatTypeExpression(type.expression, type);

    } else {
        delete expression.context;
        return ('/* DROPPED ' + JSON.stringify(expression) + '*/');
    }

}

function indent(string) {
    return '  ' + string.replace(/\n/g, '\n  ');
}

function surround(front, back, middle) {
    return front + '\n' + indent(middle) + '\n' + back;
}
