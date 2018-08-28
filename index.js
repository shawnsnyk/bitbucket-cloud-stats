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
var debug=0;

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
    var nextUrl = "";
    var arrContributorNames=[];

    nextUrl=targetUrl; //populate first target URL

    while(nextUrl!="")
    {
      console.log(nextUrl);
      var responsedata = await getDataFromBBAPI(nextUrl, config);
      //RESPONSE: { data: { pagelen: 10, values: [ [Object], [Object] ], page: 1, size: 2 , next},
      var pageSize = responsedata.data.size;
      var curPage = responsedata.data.page;
      if(responsedata.data.next)
      {
          if(debug > 0) console.log('Next Page - REPO: ' + responsedata.data.next);
          nextUrl=responsedata.data.next;
      }
      else
      {
        if(debug > 0) console.log('NO NEXT PAGE - REPO');
        nextUrl="";
      }
      if(debug > 0) 
      {
        console.log('Number of repos: ' + responsedata.data.values.length)
        console.log('Pagesize:' + pageSize);
        console.log('curPage:' + curPage);
        console.log('For Each Repo:')
      }
  
      console.log('=========Repo Commit Analysis==========');
      console.log('Repo Count: ' + responsedata.data.values.length);
      for (var i = 0, len = responsedata.data.values.length; i < len; i++) {
        console.log(responsedata.data.values[i].full_name);
        //console.log(responsedata.data.values[i].links.commits.href);
        //commit example filter: https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/%7Busername%7D/%7Brepo_slug%7D/filehistory/%7Bnode%7D/%7Bpath%7D?_ga=2.43500256.414019426.1535331392-1143805731.1535119351
        //another filter example: https://community.atlassian.com/t5/Bitbucket-questions/bitbucket-api-query-all-commits/qaq-p/651345
        var commitUrl=responsedata.data.values[i].links.commits.href + "?q=date+%3E+" + cutOffDate;
        var nextCommit=commitUrl;
        while(nextCommit!="")
        {
          var commitResponsedata = await getDataFromBBAPI(nextCommit, config);
          if(commitResponsedata.data.next)
          {
            if(debug > 0) console.log('   Next  page - commit: ' + commitResponsedata.data.next);
            nextCommit= commitResponsedata.data.next
          }
          else
          {
            if(debug > 0) console.log('NO NEXT PAGE - COMMIT');
            nextCommit= "";
          }
          var pageCommitSize = commitResponsedata.data.pagelen;
          if(debug > 0)
          {
            console.log('     pagelen:' + pageCommitSize);
            console.log('   Number of commits against repo: ' + commitResponsedata.data.values.length)
          }
          for (var j = 0, len2 = commitResponsedata.data.values.length; j < len2; j++) 
          {
            //console.log(commitResponsedata.data); //SHOW JSON object
            if(arrContributorNames.indexOf(commitResponsedata.data.values[j].author.raw)<0)
            {
              arrContributorNames.push(commitResponsedata.data.values[j].author.raw);
            }
            if(debug > 0)
            {
              //console.log('     ----Record: ' + j + '------'
              var rawSummary= commitResponsedata.data.values[j].summary.raw;
              var summarytxt = "";
              if (rawSummary.length >40)
              {
                summarytxt = '\tSummary: ' + rawSummary.substring(0,40).replace('\n','').replace('\r','').replace('\t','');
              }
              else
              {
                summarytxt = '\tSummary: ' + rawSummary.replace('\n','').replace('\r','').replace('\t','');
              }

              console.log('     repo: ' + commitResponsedata.data.values[j].repository.name +'\tauth: ' + commitResponsedata.data.values[j].author.raw + ' type: ' + commitResponsedata.data.values[j].author.type + '\tdate: ' + commitResponsedata.data.values[j].date + summarytxt);
              //if(cutOffDate>=commitResponsedata.data.values[j].date)
              //{
              //  console.log('            ****Date does not meet criteria****');
              //}
            }
          }
          if(debug > 0) console.log('----Commit Page END------');
        }
        if(debug > 0) console.log('----Repo Page END------');
      }
    }
  
    console.log('\n=====TO DO LIST FOR THIS SCRIPT====');
    console.log('TODO: Filter on cutoffdate');
    console.log('TODO: Filter on private');
    console.log('RESEARCH TO DO: what about filtering or doing pull requests like this: https://bitbucket.org/snykdemo-sm/2.0/repositories/main/repo/pullrequests?q=source.repository.full_name+%21%3D+%22main%2Frepo%22+AND+state+%3D+%22OPEN%22+AND+reviewers.username+%3D+%22snykdemo-sm%22+AND+destination.branch.name+%3D+%22master%22')
      
    console.log('\n=====Unique Names====');
    console.log('Count:' + arrContributorNames.length);
    for(var nameCounter=0; nameCounter<arrContributorNames.length; nameCounter++)
    {
      console.log(arrContributorNames[nameCounter]);
    }
  
    //Look here for date handling problem: https://community.atlassian.com/t5/Bitbucket-questions/Bitbucket-cloud-api-2-0-querying-commits-how-to-filter-on-date/qaq-p/877317#M31927
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
        getBBCloudContributorCount(config)
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

/*
//commit
{ pagelen: 30,
  values: 
   [ { hash: '2b660349cfd04f07dd5f7ecc4a0066bfccf6afff',
       repository: [Object],
       links: [Object],
       author: [Object],
       summary: [Object],
       parents: [Array],
       date: '2018-07-31T09:19:46+00:00',
       message: 'TFB-1555, TFB-1912: Dirty requests break IN_APP purchase\n',
       type: 'commit' },

*/
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