#!/usr/bin/env node
/*
        =========================================================');
        =====V1.1.0 Bitbucket Cloud - Developer Counter - last 90days======');
        =========================================================');

*/
//const INTER_CALLS_DELAY = 1000;

const NBOFDAYS = 90;
var program = require('commander');
const chalk = require('chalk'); //string style
const figlet = require('figlet'); //starwars large text
const axios = require('axios'); //HTTP agent
const moment = require('moment'); //library for processing/ formatting/parsing dates
//var sleep = require('lodash.throttle'); -alternate sleep function
var sleep = require('sleep-promise');
var includePublicRepos = true; //true of false to include public repo commits in analysis

var cutOffDate;

//Throttling Handler for BitBucket Cloud - See https://confluence.atlassian.com/bitbucket/rate-limits-668173227.html
var cutOffRepoApi=995; //1000 is limit, adding small buffer
var cutOffCommitApi=990; //1000 is limit, adding small buffer
var delayWhenThresholdMet = (3600 + (60*5))*1000; //ms - add 5 minute buffer


//API call counter
var repoApiCalls=0; //total
var commitApiCalls=0; //total
var curRepoApiCalls=0; //current timeframe of throttler
var curCommitApiCalls=0; //current timeframe of throttler

const authenticate = (options) => {
  return "";
}

const calculateCutOffDate = () => {
  cutOffDate = moment().subtract(NBOFDAYS, 'days').format('YYYY-MM-DD');
  console.log(chalk.red("Counting commits only after "+cutOffDate));
}
const introText = () => {
  return new Promise((resolve,reject) => {
    figlet.text('SNYK', {
    font: 'Star Wars',
    horizontalLayout: 'default',
    verticalLayout: 'default'
    }, function(err, data) {
      if (err) {
          console.log('Something went wrong...');
          console.dir(err);
          reject(err);
      }
      console.log(data)
      console.log("\n");
      console.log("Snyk tool for counting active contributors");
      resolve();
    });
  });
}

const getDataFromBBAPI = (url, config) => {
  return new Promise((resolve,reject) => {
    axios.get(url, {auth:{username: config.uid,password: config.token}})
    .then((response) => {
      
      resolve({"data":response.data, "headers":response.headers});
    })
    .catch((error) => {
      console.log('err response');
      reject(error);
    });

  });
}

const checkCommitThrottle = async() => {
        //Stub function for possible wait logic
        //var cutOffRepoApi=995; //1000 is limit, adding small buffer
        //var cutOffCommitApi=990; //1000 is limit, adding small buffer
        //var delayWhenThresholdMet = 65; //minutes - add 5 minute buffer
        //console.log('check sleepy:' + curCommitApiCalls + '/ ' + cutOffCommitApi);
        if(cutOffRepoApi == curRepoApiCalls || cutOffCommitApi == curCommitApiCalls)
        {
            //wait  delayWhenThresholdMet
           //CHEANGE THE CODE TO ONLY ALLOW COMMIT CHECKS 1000 times in 60 min _.throttle(func, [wait=0], [options={}])
            console.log("---------Approaching Bitbucket Cloud Api call limit. Sleeping for " + (delayWhenThresholdMet/1000)/60 + "minutes");
            curRepoApiCalls==0; //reset counter
            curCommitApiCalls==0; //reset counter
            return sleep(delayWhenThresholdMet);
        }
}

async function getBBCloudContributorCount (config) {
    var repoData = [];
    var nextUrl = "";
    var arrContributorNames=[];
    var targetUrl = config.apiurl+ "repositories/" + config.username +'/';
    var numUniqueRepos=0
    var numUniquePublicRepos=0
    var numCommits=0;
    nextUrl=targetUrl; //populate first target URL
    try
    {
        while(nextUrl!="") //BB uses pages in API, iterate until all pages processed for repositories
        {
            console.log(nextUrl);
            var responsedata = await getDataFromBBAPI(nextUrl, config);
            repoApiCalls++;
            curRepoApiCalls++;
            if(responsedata.data.next)
            {
                nextUrl=responsedata.data.next;
            }
            else
            {
                nextUrl="";
            }
        
            console.log('=========Repo Commit Analysis==========');
            
            for (var i = 0, len = responsedata.data.values.length; i < len; i++) {
                
                var is_private = responsedata.data.values[i].is_private; //check if repo is private, by default only these are analyzed
                numUniqueRepos++;
                
                if(is_private==true)
                {
                    console.log(responsedata.data.values[i].full_name + '\t' + ' (Private)');
                }
                else
                {
                    numUniquePublicRepos++;
                    if(includePublicRepos==false) console.log(responsedata.data.values[i].full_name + '\t' +  ' (Public - Skipping)');
                    else
                    {
                        console.log(responsedata.data.values[i].full_name + '\t' +  ' (Public)');
                    }
                }
            
                var commitUrl=responsedata.data.values[i].links.commits.href;// + "?q=date+%3E+" + cutOffDate;
                var nextCommit=commitUrl;
                var numRepoCommits=0;
                //BB uses pages in API, iterate until all pages processed for commits, but only looking at private repos unless overridden
                while(nextCommit!="" && (is_private==true || includePublicRepos==true)) 
                {
                    //PROPOSAL - add logic here to check checkCommitThrottle(). If it's reached the counter limit for api calls , sleep for 60 minutes - see function
                    //await checkCommitThrottle();
                    await checkCommitThrottle();
                    var commitResponsedata = await getDataFromBBAPI(nextCommit, config);
                    commitApiCalls++;
                    curCommitApiCalls++;
                    if(commitResponsedata.data.next)
                    {
                        nextCommit= commitResponsedata.data.next
                    }
                    else
                    {
                        nextCommit= "";
                    }

                    for (var j = 0, len2 = commitResponsedata.data.values.length; j < len2; j++) 
                    {
                        //only record name if it's after cuttoffdate.
                        if(commitResponsedata.data.values[j].date >= cutOffDate)
                        {
                            numCommits++;
                            numRepoCommits++;
                            if(arrContributorNames.indexOf(commitResponsedata.data.values[j].author.raw)<0)
                            {
                                arrContributorNames.push(commitResponsedata.data.values[j].author.raw);
                            }
                        } //else, once the dates are found not to be in range, you might be able to abandon commits loop and skip all other commit pages. Research further.
                        else //skip future commit pages
                        {
                            nextCommit="";
                            break;
                        }
                    }
                }
            }
        }
    }
    catch (err) 
    {
        console.error("CRITICAL FAILURE: Failed to process repo data\n");
        console.error(err);
    }
    console.log('\nTotal Repo Count: ' + numUniqueRepos);
    console.log('Total Private Repo Count: ' + (numUniqueRepos-numUniquePublicRepos));
    console.log('Total Public Repo Count: ' + numUniquePublicRepos);
    console.log('Total Commits Analyzed (Before Cuttoff) Count: ' + numCommits);
    
     
    console.log('\n=====Unique Names====');
    for(var nameCounter=0; nameCounter<arrContributorNames.length; nameCounter++)
    {
      console.log(arrContributorNames[nameCounter]);
    }
    console.log('\nUnique User Count:' + arrContributorNames.length);
    console.log('\n=====Script Stats====');
    console.log('Repo Api Call Count:' + repoApiCalls);
    console.log('Commit Api Call Count:' + commitApiCalls);
    
    console.log('\n=====Script Settings====');
    console.log('includePublicRepos: ' + includePublicRepos)

    console.log('\n========================');
    console.log('=====Script Complete====');
    console.log('========================');
    return repoData;
  }

  

program
  .version('1.0.0')
  .description('Snyk\'s BitBucket Cloud contributors counter (active in the last 3 months)')
  .usage('<command> [options] \n options: -t <BBAppPassword> -u <BBUid> -r <BBRepoUserName>')

  program
    .command('contributorCount')
    .description('Count number of active contributors to BB Cloud repo across an entire organization')
    .option('-t, --apppassword [BBAppPassword]', 'Running command with BB App Password')
    .option('-u, --uid [BBUid]', 'BB Cloud Login User Id')
    .option('-r, --ruid [BBRepoUserName]', 'BB Cloud Repo User Id')
    .action((options) => {
      introText()
      .then(() => {
        var config = {
          username: options.ruid,
          uid: options.uid,
          token:  options.apppassword,
          apiurl: "https://api.bitbucket.org/2.0/"
        };
       
        calculateCutOffDate();
        getBBCloudContributorCount(config)
        .then((data) => {
          //console.log(data);
        })
      })
      .catch((error)=>{
        console.error(error);
      })
      
    });

program.parse(process.argv);

if (program.args.length === 0) program.help();

