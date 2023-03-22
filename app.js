#!/usr/bin/env node
import fs from 'fs';
import { exec } from 'node:child_process';
import os from 'os';
import ora from "ora";
import enquirer from 'enquirer';
import getFolderSize from 'get-folder-size';
import chalk from "chalk";


const getDirList = async () => {
    let myOS = os.type();
    let folder = 'node_modules';

    let findCmd = myOS === 'Windows_NT' ? `dir ${folder} /AD/S/B` : myOS === 'Linux' ? `find / -type d -name ${folder}` : myOS === 'Darwin' ? `mdfind kind:folder "${folder}"` : undefined;

    if (findCmd) {
        return new Promise(async function (resolve, reject) {
            await exec(findCmd, async (error, stdout, stderr) => {
                if (error) {
                    reject(`Error: ${stderr}`);
                } else {
                    resolve(stdout.split('\n').filter(String).map(path => {
                        return path.split('/node_modules')[0] + '/node_modules/';
                    }));
                }
            })
        })
    } else {
        console.clear();
        console.log(chalk.red("sorry, tool can't running. please report this issue to: https://rianzesh.netlify.app"));
        process.exit();
    }
}


const getDirSize = async (path) => {
    const size = await getFolderSize.loose(path);
    return (size / 1000 / 1000).toFixed(2);
}


const removeDuplicate = async (pathData) => {
    return new Promise(async (resolve) => resolve([...new Set(pathData)]))
}


const packageJsonAppReader = async (filePath) => {
    let spaces = "                                     ";

    return await Promise.all(
        filePath.map(async x => await getDirSize(x.replace('/package.json', '/node_modules'))),
    ).then(res => {
        return filePath.map((c, idx) => {
            let json = JSON.parse(fs.readFileSync(c, 'utf8'));
            let tempVal = json.name ? json.name : c.replace('/package.json', '').split('/')[c.replace('/package.json', '').split('/').length - 1];
            return {
                value: tempVal,
                message: c.replace('/package.json', '').split('/')[c.replace('/package.json', '').split('/').length - 1],
                name: c.replace('/package.json', '/node_modules'),
                alias: '  ' + tempVal + spaces.slice(0, spaces.length - tempVal.length) + res[idx] + ' MB',
                size: res[idx],
                status: true
            };
        })
    });
}


const fileExist = async (pathData) => {
    return new Promise(async (resolve) => {
        resolve(pathData.map((c) => {
            let newPath = c.split('/node_modules')[0] + "/package.json";
            if (fs.existsSync(newPath)) { return newPath };
        }).filter(e => e));
    })
}


const removeDir = (path) => {
    fs.rm(path, { recursive: true }, () => { return true });
    return true;
}


const getData = async () => {
    let getNMDir = await getDirList();
    let sortNM = await removeDuplicate(getNMDir);
    let cleanedNM = await fileExist(sortNM);
    let getAppName = await packageJsonAppReader(cleanedNM);
    return getAppName;
}


const App = async () => {
    const spinner = ora("Finding Node Modules...").start();
    const $data = await (getData());
    let currentPrompt;
    let selectedIdx;
    let exit = false;

    let version = '0.7.0';
    let author = 'rahmatrians';

    spinner.succeed();
    console.clear();

    do {
        console.log(`${chalk.hex('#E96479').bold('nmkill')}(${version})\t@${author}\n`);

        let nmData = await $data;
        if (!selectedIdx) {
            currentPrompt?.clear();
            currentPrompt = await new enquirer.Select({
                message: `Choose the Node Modules:`,
                choices: [...nmData.map(e => e.alias), { name: 'exit', message: '  Exit', value: 'exit' }]
            });

            await currentPrompt.run()
                .then(async answer => (answer === 'exit') ? exit = true : ($data[currentPrompt.index].status) && (selectedIdx = await currentPrompt.choices[currentPrompt.index].index + 1)
                ).catch(console.error);
        }
        else {
            currentPrompt?.clear();
            currentPrompt = await new enquirer.Toggle({
                message: `Are you sure want to remove "${$data[selectedIdx - 1].value}"?`,
                enabled: 'Yap',
                disabled: 'Nope'
            });

            await currentPrompt.run()
                .then(async answer => (
                    await answer && (
                        removeDir($data[selectedIdx - 1].name) &&
                        ($data[selectedIdx - 1].alias = await chalk.green("✔ " + $data[selectedIdx - 1].alias.slice(2, $data[selectedIdx - 1].alias.length)),
                            $data[selectedIdx - 1].status = false)
                    ),
                    selectedIdx = undefined
                ))
                .catch(console.error);
        }

        console.clear();
        currentPrompt?.clear();

    } while (!exit);

    return;
}

App();