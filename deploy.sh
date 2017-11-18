#!/bin/bash

./Bluemix_CLI/bin/bluemix config --check-version false
./Bluemix_CLI/bin/bluemix api https://api.ng.bluemix.net
./Bluemix_CLI/bin/bluemix login --apikey $BXIAM
./Bluemix_CLI/bin/bluemix target -o $CF_ORGANIZATION -s $CF_SPACE
./Bluemix_CLI/bin/bluemix cf push $APP_NAME --no-start
./Bluemix_CLI/bin/bluemix cf set-env $APP_NAME CLOUDANT_URL $CLOUDANT_URL
./Bluemix_CLI/bin/bluemix cf set-env $APP_NAME CLOUDANT_DB $CLOUDANT_DB
./Bluemix_CLI/bin/bluemix cf start $APP_NAME
