#!/bin/bash

show_menu() {
    echo "Select an option:"
    echo "0) Exit"
    echo "1) Placeholder"
}

echo "\n\nThis is testing for development.
The intention is to provide quick ways to perform certain actions to quicken dev iterations.
For example: instead of going through the entire pipeline to see if a report is formatted correctly, just generate the report with a known input.
This is experimental, idk if I'll keep it or not. 
---------
"

# Main loop
while true
do 
    show_menu
    read -p "Enter choice: " choice
    case "$choice" in
        0) echo "Exiting..."
        exit 0
        ;;
        1) echo "This is a placeholder"
        ;;
        
        *) "Insert something witty about entering the wrong number"
    esac
done