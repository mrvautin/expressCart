const path = require('path');
module.exports = {
    entry: './public/src/app.js',
    output: {
        path: path.resolve('public', 'dist'),
        filename: 'app.js'
    },
    module: {
        loaders: [
            {test: /\.js$/, loader: 'babel-loader', exclude: /node_modules/, query: {presets: ['react']}},
            {test: /\.jsx$/, loader: 'babel-loader', exclude: /node_modules/, query: {presets: ['react']}}
        ]
    }
};
