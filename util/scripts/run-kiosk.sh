#!/bin/bash -ex

BEAGLEK_URL=${BEAGLEK_URL:-http://plaka.local:3000/sg/}
STATUSPAGE_URL=~/statuspage/index.html
STATUSPAGE_TEMPLATE=~/statuspage/index.html.template

[ -z "${DISPLAY}" ] && export DISPLAY=:0

wd=""
weasel_pid=""

killall iceweasel >> /dev/null 2>&1 || true

function get_wd() {
    dir=$(dirname ${1})
    [ -z "${dir}" ] && dir=.
    d=$(cd ${dir}; pwd)
    echo ${d}
}

function clean_profile_lock() {
    # Remove the profile lock so that Iceweasel won't offer
    # resetting everything.
    find ~/.mozilla -name .parentlock -print0 | xargs -0 rm -f
}

function cleanup_statusbrowser() {
    [ -n "${weasel_pid}" ] && kill ${weasel_pid} || true
}

function generate_statuspage() {
    wlan_info=$(/sbin/iwconfig wlan0 | \
                       sed -e 's,$,\\n,g' -e 's,",\\",g' | tr -d '\n')
    ipaddr_info=$(ip addr | sed -e 's,$,\\n,g'  -e 's,",\\",g' | tr -d '\n')

    awk "{sub(/WLAN_INFO/, \"${wlan_info}\"); sub(/IPADDR_INFO/, \"${ipaddr_info}\"); print}" ${STATUSPAGE_TEMPLATE} > ${STATUSPAGE_URL}
}

function verify_url() {
    curl ${BEAGLEK_URL} >> /dev/null 2>&1
    return $?
}

function verify_signalk_available() {
    while ! verify_url ; do
        generate_statuspage
        if [ -n "${weasel_pid}" ] ; then
            ${wd}/reload.sh || true
        else
            clean_profile_lock
            iceweasel ${STATUSPAGE_URL} &
            weasel_pid="$!"
        fi
        sleep 10
    done

    [ -n "${weasel_pid}" ] && kill ${weasel_pid} || true
}

function run_beaglek_browser() {
    clean_profile_lock
    iceweasel ${BEAGLEK_URL}
}

trap cleanup_statusbrowser INT EXIT TERM

wd=$(get_wd "$0")
verify_signalk_available
run_beaglek_browser
