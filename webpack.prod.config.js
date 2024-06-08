const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const mainConfig =  {
  mode: 'production', // または 'development'
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'main.js'
  },
  target: 'electron-main',
  node: {
    __dirname: false,
    __filename: false,
  },
  externals: {
    'faiss-node': 'commonjs2 faiss-node'
  },
  module: {
    rules: [
      {
        test: /\.node$/,
        use: 'node-loader'
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  }
};

const preloadConfig = {
  mode: 'production',
  entry: './src/preload.js',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'preload.js'
  },
  target: 'electron-preload',
  node: {
    __dirname: false,
    __filename: false,
  },
  externals: {
    'faiss-node': 'commonjs2 faiss-node'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  }
};

const rendererConfig = {
  mode: 'production',
  entry: './src/renderer.js',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'renderer.js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: path.resolve(__dirname, 'node_modules'),
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  target: 'electron-renderer',
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public/styles', to: 'styles' }, // CSSファイルをコピー
        { from: 'src/locales', to: 'locales' } // localeファイルをコピー
      ]
    })
  ]
};


module.exports = [mainConfig, preloadConfig, rendererConfig]