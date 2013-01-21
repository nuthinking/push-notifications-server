#!/bin/bash

if [ `ps -u USERNAME | grep -i PROCESS | wc -l` -lt 1 ]
then
    echo "Starting <PROCESS>."
    #<enter the command to start your process here>
else
    echo "<PROCESS> is running."
fi