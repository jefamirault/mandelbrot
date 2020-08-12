require 'json'
require 'fileutils'
require_relative 'composite_render'
require_relative 'worker'

if ARGV[0].nil?
  raise 'Missing blueprint path'
end



@command_list = %w(queue process composite)

command = ARGV[1]

def invalid_command
  raise "Command invalid. Allowed commands: [#{@command_list.join(', ')}]"
end

invalid_command if command.nil?


flag = @command_list.map {|c| command == c }.reduce :&
if flag
  invalid_command
end



json = File.read(ARGV[0])
blueprint = JSON.parse json
options = blueprint.transform_keys(&:to_sym)

directory = options[:directory]



if command == 'queue'


  jobs = CompositeRender.new(options).create_jobs

  # add jobs to queue
  queue = []
  jobs.each do |param|
    queue.unshift param
  end

  # save queue
  puts "Updating Queue"

  FileUtils.mkdir_p directory

  File.open("#{directory}/queue", 'w+') do |f|
    Marshal.dump(queue, f)
  end

end

# Process jobs from queue in parallel
if command == 'process'
  number_of_processes = (ARGV[2] || 6).to_i

  Parallel.map(number_of_processes.times.to_a, in_processes: number_of_processes) do |i|
    worker = Worker.new directory: directory
    worker.run
  end
end

