require 'json'
require 'fileutils'
require_relative 'composite_render'

json = File.read(ARGV[0])
blueprint = JSON.parse json
options = blueprint.transform_keys(&:to_sym)

jobs = CompositeRender.new(options).create_jobs

# add jobs to queue
queue = []
jobs.each do |param|
  queue.unshift param
end

# save queue
puts "Updating Queue"

folder = options[:directory]
FileUtils.mkdir_p folder

File.open("#{folder}/queue", 'w+') do |f|
  Marshal.dump(queue, f)
end


