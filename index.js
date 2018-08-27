#!/usr/bin/env node
/*
        =========================================================');
        =====THIS PROGRAM IS WORK IN PROGRESS - DO NOT USE!======');
        =========================================================');
*/
const INTER_CALLS_DELAY = 1000;
const NB_RECORDS_PER_PAGE = 100; //max GL API
const DEFAULT_BitBucket_COM_API = 'https://bitbucket.org/site/'; //   /2.0/repositories/shawnsnyk/bitbucket-cloud-stats/

const NBOFDAYS = 90;
//2016-08-01T00:00:00.000+00:00

var program = require('commander');
const chalk = require('chalk'); //string style
const figlet = require('figlet'); //starwars large text
const axios = require('axios'); //HTTP agent
const moment = require('moment'); //library for processing/ formatting/parsing dates
var debug=1;

var cutOffDate;

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
    if(debug > 0)
      {
        console.log('Retrieving data from: ' + url);
      }
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



async function getBBCloudContributorCount (config) {
    var targetUrl = config.apiurl+ "repositories/" + config.username +'/';
    var repoData = [];
    var responsedata = await getDataFromBBAPI(targetUrl, config);
    //RESPONSE: { data: { pagelen: 10, values: [ [Object], [Object] ], page: 1, size: 2 , next},
    var pageSize = responsedata.data.size;
    var curPage = responsedata.data.page;

    console.log('For Each Repo:')
    for (var i = 0, len = responsedata.data.values.length; i < len; i++) {
      console.log('=========Repo Start: ' +  responsedata.data.values[i].full_name +  '=============');
      //console.log(responsedata.data.values[i].links.commits.href);
      var commitUrl=responsedata.data.values[i].links.commits.href
      var commitResponsedata = await getDataFromBBAPI(commitUrl, config);
      console.log('----COMMIT RECORD Start------');
      for (var j = 0, len = commitResponsedata.data.values.length; j < len; j++) 
      {
        
        if(debug > 0)
        {
          console.log('     ----Record: ' + j + '------');
          console.log('     ' + commitResponsedata.data.values[j].repository.name);
          console.log('     ' + commitResponsedata.data.values[j].author.raw + ' type: ' + commitResponsedata.data.values[j].author.type);
          console.log('     ' + commitResponsedata.data.values[j].date);

          var rawSummary= commitResponsedata.data.values[j].summary.raw
          if (rawSummary.length >30)
          {
            console.log('     ' + rawSummary.substring(0,80).replace('\n','').replace('\r',''));
          }
          else
          {
            console.log('     ' + rawSummary.replace('\n','').replace('\r',''));
          }
          console.log('----COMMIT RECORD END------');
        }
      }
      console.log('----Repo END------');
    }
    if(debug > 0)
    {
      console.log('TODO: Paginating repos');
      console.log('TODO: Paginating commits');
      console.log('TODO: Filter on cutoffdate');
      console.log('RESEARCH TO DO: what about filtering or doing pull requests like this: https://bitbucket.org/snykdemo-sm/2.0/repositories/main/repo/pullrequests?q=source.repository.full_name+%21%3D+%22main%2Frepo%22+AND+state+%3D+%22OPEN%22+AND+reviewers.username+%3D+%22snykdemo-sm%22+AND+destination.branch.name+%3D+%22master%22')
    }
    //MAJOR TO DO: YOU STILL NEED TO HANDLE PAGING --Look at NEXT and start this whole thing over again!
    //    probably move this logic out of function, passing target url while there's a "next" defined
    //probably   responsedata.data.next
    return repoData;
  }

  async function getBBCloudContributorCountV2 (config) {

    //works better - filtered: curl -l --user userid:yourapppassword https://api.bitbucket.org/2.0/repositories/
  
    // return new Promise((resolve, reject) => {
      var targetUrl = config.apiurl+ "repositories/" + config.username +'/';
      var repoData = [];
      console.log('Target Url:' + targetUrl);
      var responsedata = await getDataFromBBAPI(targetUrl, config);
      //RESPONSE: { data: { pagelen: 10, values: [ [Object], [Object] ], page: 1, size: 2 , next},
  
      //console.log(data);
      //console.log('Data Retrieved');
      //repoData.push(...data.data); //?? What is ...
      var pageSize = responsedata.data.size;
      var curPage = responsedata.data.page;
  
      console.log('=========================For Each Repo============================')
      for (var i = 0, len = responsedata.data.values.length; i < len; i++) {
        //console.log(responsedata.data.values[i]);
        console.log('=========Repo Start: ' +  responsedata.data.values[i].full_name +  '=============');
        //YOU NEED TO PASS CUTOFF DATE AS A FILTER AND THINK OF PAGINATION OF COMMITS
        console.log(responsedata.data.values[i].links.commits.href);
        //var commitUrl=responsedata.data.values[i].links.commits.href + "?created_on>" + cutOffDate;// + "T:00:00:00";
        var commitUrl=targetUrl + responsedata.data.values[i].name + "/pullrequests?q=created_on>2018-01-01" //+ cutOffDate;// + "T:00:00:00";
        var commitResponsedata = await getDataFromBBAPI(commitUrl, config);
        console.log(commitResponsedata);
        console.log('----COMMIT RECORD Start------');
        /*for (var j = 0, len = commitResponsedata.data.values.length; j < len; j++) 
        {
          
          if(debug > 0)
          {
            console.log('     ----Record: ' + j + '------');
          //console.log(commitResponsedata.data.values[i]);
            console.log('     ' + commitResponsedata.data.values[j].repository.name);
            console.log('     ' + commitResponsedata.data.values[j].author.raw + ' type: ' + commitResponsedata.data.values[j].author.type);
            console.log('     ' + commitResponsedata.data.values[j].date);
  
            var rawSummary= commitResponsedata.data.values[j].summary.raw
            if (rawSummary.length >30)
            {
              console.log('     ' + rawSummary.substring(0,80).replace('\n','').replace('\r',''));
            }
            else
            {
              console.log('     ' + rawSummary.replace('\n','').replace('\r',''));
            }
            //console.log('     ' +commitResponsedata.data.values[i].message);
  
            console.log('----COMMIT RECORD END------');
          }
        }*/
        console.log('----Repo END------');
      }
      if(debug > 0)
      {
        console.log('TODO: Paginating repos');
        console.log('TODO: Paginating commits');
        console.log('TODO: Filter on cutoffdate');
        console.log('RESEARCH TO DO: what about filtering or doing pull requests like this: https://bitbucket.org/snykdemo-sm/2.0/repositories/main/repo/pullrequests?q=source.repository.full_name+%21%3D+%22main%2Frepo%22+AND+state+%3D+%22OPEN%22+AND+reviewers.username+%3D+%22snykdemo-sm%22+AND+destination.branch.name+%3D+%22master%22')
        console.log('=========================================================');
        console.log('=====THIS PROGRAM IS WORK IN PROGRESS - DO NOT USE!======');
        console.log('=========================================================');
      }
      //MAJOR TO DO: YOU STILL NEED TO HANDLE PAGING --Look at NEXT and start this whole thing over again!
      //    probably move this logic out of function, passing target url while there's a "next" defined
      //probably   responsedata.data.next
      return repoData;
    }

program
  .version('1.0.0')
  .description('Snyk\'s BitBucket contributors counter (active in the last 3 months)')
  .usage('<command> [options] \n options: -t <BBAppPassword> -u <BBUid> -r <BBRepoUserName>')

//OATH For later: https://stackoverflow.com/questions/41519092/using-axios-get-with-authorization-header-in-react-native-app
//App passwords: https://blog.bitbucket.org/2016/06/06/app-passwords-bitbucket-cloud/
//      how to use api1.0bit: https://confluence.atlassian.com/bitbucket/app-passwords-828781300.html
//    types of auth: https://developer.atlassian.com/bitbucket/api/2/reference/meta/authentication

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
        getBBCloudContributorCountV2(config)
        .then((data) => {
          //console.log(data);
        })
      })
      .catch((error)=>{
        console.log('Bad code, be ashamed');
        console.error(error);
      })
      
    });

program.parse(process.argv);

if (program.args.length === 0) program.help();

//root /2.0/repositories/shawnsnyk/bitbucket-cloud-stats
//Pull reqs by user:   /2.0/repositories/shawnsnyk/bitbucket-cloud-stats/pullrequests?q=source.repository.full_name+%21%3D+%22main%2Frepo%22+AND+state+%3D+%22OPEN%22+AND+reviewers.username+%3D+%22evzijst%22+AND+destination.branch.name+%3D+%22master%22
/*Fields: https://developer.atlassian.com/bitbucket/api/2/reference/meta/filtering
title (string)
description (string)
author (embedded user object)
reviewers (embedded user object)
state (string)
source.repository (embedded repository object)
source.branch.name (string)
destination.repository (embedded repository object)
destination.branch.name (string)
close_source_branch (boolean)
closed_by (embedded user object)
reason (string)
created_on (datetime)
updated_on (datetime)
task_count (number)
comment_count (number)
*/ 

//sample url
//https://bitbucket.org/snykdemo-sm/2.0/repositories/main/repo/pullrequests?q=source.repository.full_name+%21%3D+%22main%2Frepo%22+AND+state+%3D+%22OPEN%22+AND+reviewers.username+%3D+%22snykdemo-sm%22+AND+destination.branch.name+%3D+%22master%22


    //Get repos object - Responses are paginated, see "NEXT FIELD"
    /*
    {
      values:[ 
        {
          scm:git
            name:goof-bb
            links: {
              commits:{
               href: https://api.bitbucket.org/2.0/repositories/snykdemo-sm/goof-bb/commits
              }
            }
            full_name
            is_private
            slug:
            type:repository
        },
        {
            scm:git
            name:java-goof-bb
            links: {
              commits:{
               href: https://api.bitbucket.org/2.0/repositories/snykdemo-sm/java-goof-bb/commits
              }
              ???Do we go through branches?
              ?what about clones?
              ?forks?
            }
            full_name
            is_private
            slug:
            type:repository
        }


      ]
      next: "https://api.bitbucket.org/2.0/repositories?after=2008-07-12T09%3A37%3A06.254721%2B00%3A00"
    }
    */