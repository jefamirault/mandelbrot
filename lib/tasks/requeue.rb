# If you are running a large batch render and a worker is interrupted, that job is left incomplete.
# The interrupted jobs must be returned to the queue. Fill in the indices of missing renders and they
# will be added to the front of the queue.

# FILL IN THIS PART MANUALLY
@missing_renders = [6,7,9]


require 'fileutils'
require_relative '../composite_render'

@directory = 'renders/test/pinwheel'

@options = {
    prefix: ''
}

# recreate jobs

@options[:center] = [0.281717921930775, 0.5771052841488505]
@options[:iterations] = 8000
@options[:grid_size] = 6
@options[:resolution] = [740, 416]
@options[:step] = 1.0e-7

@jobs = CompositeRender.new(@options).create_jobs


#  read queue
File.open("#{@directory}/queue") do |f|
  @queue = Marshal.load(f)
end

# add cherry-picked jobs to FRONT of queue
@missing_renders.each do |index|
  @queue.push @jobs[index]
end

# update queue
File.open("#{@directory}/queue", 'w+') do |f|
  Marshal.dump(@queue, f)
end
