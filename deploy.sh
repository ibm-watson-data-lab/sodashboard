#!/bin/bash

# login and set target
./Bluemix_CLI/bin/bluemix config --check-version false
./Bluemix_CLI/bin/bluemix api https://api.ng.bluemix.net
./Bluemix_CLI/bin/bluemix login --apikey $BXIAM
./Bluemix_CLI/bin/bluemix target -o $CF_ORGANIZATION -s $CF_SPACE
# push app but don't start it (app start will fail unless the following environment
# variables are defined: CLOUDANT_URL, CLOUDANT_DB and SLACK_TOKEN
./Bluemix_CLI/bin/bluemix cf push $APP_NAME --no-start
# set required environment variables
./Bluemix_CLI/bin/bluemix cf set-env $APP_NAME CLOUDANT_URL $CLOUDANT_URL
./Bluemix_CLI/bin/bluemix cf set-env $APP_NAME CLOUDANT_DB $CLOUDANT_DB
./Bluemix_CLI/bin/bluemix cf set-env $APP_NAME SLACK_TOKEN $SLACK_TOKEN
# start the app
./Bluemix_CLI/bin/bluemix cf start $APP_NAME
