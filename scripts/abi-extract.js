#!/usr/bin/env node

// MIT License

// Copyright (c) 2018 Maxime Biais
// Copyright (c) 2020 Ahmed Tawfeeq

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const minimist = require("minimist");
const winston = require("winston");

const logger = winston.createLogger({
  levels: winston.config.syslog.levels,
  level: "notice",
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

function exportAbiForFile(filename) {
  if (filename.endsWith(".json")) {
    const data = fs.readFileSync(filename);
    const jsonData = JSON.parse(data);
    if (jsonData.hasOwnProperty("abi")) {
      logger.info("Found ABI in: " + filename);
      return jsonData["abi"];
    }
  }
  return null;
}

function exportAbiForFileDirectory(fileDir) {
  var res = [];
  logger.info("Extracting ABI from: " + fileDir);
  jsonAbi = exportAbiForFile(fileDir);
  if (jsonAbi !== null) {
    res = _.union(res, jsonAbi);
  }
  return res;
}

function printHelp() {
  console.log(
    "Options:\n" +
      "   -a / --artifact: Truffle build file\n" +
      "   -v / --verbose"
  );
}

const outDir = "abi";

function main() {
  var args = minimist(process.argv.slice(2), {
    alias: { a: "artifact", v: "verbose" },
    boolean: ["verbose"],
  });
  if (args.verbose) {
    logger.level = "info";
  }
  for (const file of [].concat(args.artifact)) {
    const inFileName = file
      .split("/")
      [file.split("/").length - 1].split(".json")[0];
    const outFileName = _.kebabCase(inFileName);
    fs.stat(file, (err, stats) => {
      if (!err && stats.isFile()) {
        abi = exportAbiForFileDirectory(file);

        const outFile = `${outDir}/${outFileName}.json`;
        try {
          fs.readdirSync("abi");
        } catch (error) {
          fs.mkdirSync("abi");
        }
        fs.writeFileSync(outFile, JSON.stringify(abi, null, 2));
        logger.notice("ABI extracted and output file wrote to: " + outFile);
      } else {
        logger.error(
          '"' +
            file +
            '" must be a Truffle build file, you might need the -a or --artifact argument'
        );
        printHelp();
        process.exit(2);
      }
    });
  }
}

main();
