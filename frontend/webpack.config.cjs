const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isDev = process.env.NODE_ENV !== 'production';

module.exports = {
  mode: isDev ? 'development' : 'production',
  entry: './src/main.jsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: isDev ? 'bundle.js' : 'bundle.[contenthash].js',
    publicPath: '/',
    clean: true,
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.(png|jpe?g|gif|svg|woff2?|ttf|eot)$/i,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'index.html',
      favicon: false,
    }),
  ],
  devServer: {
    port: 3000,
    static: [
      {
        directory: path.resolve(__dirname),
        publicPath: '/',
      },
    ],
    devMiddleware: { publicPath: '/' },
    historyApiFallback: true,
    hot: true,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost/pfe_soutenance_manager/backend',
        changeOrigin: true,
        secure: false,
        withCredentials: true,
      },
      '/uploads': {
        target: 'http://localhost/pfe_soutenance_manager/backend',
        changeOrigin: true,
        pathRewrite: { '^/uploads': '/uploads' },
      },
    },
  },
};
