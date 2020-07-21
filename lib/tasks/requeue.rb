# If you are running a large batch render and a worker is interrupted, that job is left incomplete.
# The interrupted jobs must be returned to the queue. Fill in the indices of missing renders and they
# will be added to the front of the queue.

# FILL IN THIS PART MANUALLY
@missing_renders = [457]


require 'fileutils'
require_relative '../factory/composite_render'

@directory = 'renders/lightning/composite'

@options = {
    prefix: 'lightning'
}

# recreate jobs

@options[:center] = [-1.315180982097868, 0.073481649996795]
@options[:iterations] = 8000
@options[:grid_size] = 32
@options[:tile_resolution] = [740, 416]
@options[:step] = 2.0e-11

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
